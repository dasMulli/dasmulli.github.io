---
layout: post.html
title: Make dotnet test work on solution files
description: "Using the dotnet test command on solutions containing non-test projects currently erros. Here's a workaround."
date: 2018-01-20
tags: [msbuild vstest .net-core]
collection: posts
comments: true
lunr: true
background-image: triangular.png
---

The `dotnet` cli's `test` command can be run on any msbuild project or solution, yet it fails when run on non-test projects and prints errors like:

```
No test is available in [SomeApp].dll. Make sure test project has a nuget reference of package "Microsoft.NET.Test.Sdk" and framework version settings are appropriate and try again.

Test Run Aborted.
```

While this is useful to not mistakenly assume that all your tests ran correctly, it prevents you from just running all tests in your solution in one invocation.

Some suggst writing bash or powershell scripts to work around this, I suggest a pure msbuild-based approach that works cross-platform. Let's have a look at the workaournd first before examining it in more detail:

1. Create a file named `Directory.Build.targets` in the solution's directory with the following contents:

```xml
<Project>
  <Target Name="VSTestIfTestProject">
    <CallTarget Targets="VSTest" Condition="'$(IsTestProject)' == 'true'" />
  </Target>
</Project>
```

2. Create a file named `after.[YourSolution].sln.targets` next to the `.sln` file. It is important that you replace `[YourSolution]` with the actual name of your solution file.

```xml
<Project>
  <Target Name="VSTest">
    <MSBuild Projects="@(ProjectReference)" Targets="VSTestIfTestProject" />
  </Target>
</Project>
```

3. Run `dotnet test` in the solution's directory and it should work just fine.

## How does it work?

To understand this workaround, we need to know a bit about how VSTest (the runner that powers `dotnet test` and Visual Studio's testing features) and MSBuild solutions work:

The `dotnet test` only runs msbuild on the target file to invoke the `VSTest` msbuild target. So `dotnet test -c Reelase` is equivalent to `dotnet msbuild /t:VSTest /p:Configuration=Release`. The `/t:` argument tells MSBuild which target(s) to run and `/p:` arguments are used to set arbitrary properties that the definitions and targets involved in building the project understand.

When all projects in a solution have a target with the same name, the target can also be run on the solution file, which then invokes the actual targets in all projects. Since VSTest is contained in the CLI as an msbuild extension, the extension target is added to all project files.
This made running `dotnet test` with errors possible in the first place.

This workaround replaces the `VSTest` target on the solution with a custom target. Since MSBuild automatically includes files using a naming convention, the `after.[SlnName].sln.targets` file is ideal to do this. `dotnet test` will now call this custom target on the solution instead of the one proveded in the CLI installation for all projects. In this custom target, we can then use the [MSBuild task](https://docs.microsoft.com/en-us/visualstudio/msbuild/msbuild-task) to call another custom target on all projects. A solution file is converted to an MSBuild project internally, that has project references to all projects in the solution. This allows us to use `@(ProjectReference)` as a way to reference all projects in the solution.

This other custom target is implemented in `Directory.Build.targets`. MSBuild 15 searches the directory hierarchy for files files named `Directory.Build.props` or `Directory.Build.targets` to automatically include in the project file. The `.props` file - if found - will be imported at the beginning of the project, and the `.targets` file will be imported after the main content of the project. The default convention that has arisen in MSBuild development is to use `.targets` files for logic and `.props` files to set configuration properties and defaults to later use in logic, giving the project content ("in the middle") an opportunity to change these properties.

The custom target only checks if the property `$(IsTestProject)` is set to `true`. This property is set inside an MSBuild `.props` file that comes from the NuGet package `Microsoft.NET.Test.Sdk`. So the condition in the custom target will only match for projects that are really test projects meant to be used with VSTest. The target uses `<CallTarget>` to call the actual `VSTest` target if the condition matches. The use of this task is usually avoided if possible because the control flow is hard to follow and may have unexpected side effects, but in this case is the shortest way to do what is needed.

## Example

To see a working example, check out my GitHub repository [dotnet-win32-service](https://github.com/dasMulli/dotnet-win32-service/tree/a87bad6642c35afe906bf3dec5bd6a5acb237948).