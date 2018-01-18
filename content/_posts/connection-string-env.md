---
layout: post.html
title: Auto-modifying connection strings based on the environment
description: "Ease development and ops by configuring only one connection string and use code to modify it based on the current environment."
date: 2017-01-18
tags: [asp.net-core ef-core]
collection: posts
comments: true
lunr: true
background-image: triangular.png
---

To help ease managing databases and connection strings for our team using shared infrastructure (and non-`localhost` development databases), we needed a way to easily configure database connection strings to:

* Easily identify databases on a server - what project/environment is using it?
* Make sure we don't touch databases of other team members during development.
   * e.g. when creating or merging/rebasing migrations

We use Entity Framework Core and it turned out the easisest way to configure this was to:

1. Only have a single "base" connection string in `appsettings.json`
2. Append the current environment name to the Database.
   * e.g. `MyDb_Production`, `MyDb_Staging` etc.
3. Append the machine name when in development to avoid conflicts with team members.
   * e.g. `MyDb_Development_DEVW10MARTIN`

This can be done in `ConfigureServices` when configuring EF Core:

```csharp
public class Startup
{
    public Startup(IConfiguration configuration, IHostingEnvironment hostingEnvironment)
    {
        Configuration = configuration;
        HostingEnvironment = hostingEnvironment;
    }

    public IConfiguration Configuration { get; }

    public IHostingEnvironment HostingEnvironment { get; }

    public void ConfigureServices(IServiceCollection services)
    {
        services.AddDbContextPool<MyDbContext>(options =>
        {
            var connectionString = Configuration.GetConnectionString("MyDbConnection");

            var connectionStringBuilder = new SqlConnectionStringBuilder(connectionString);

            connectionStringBuilder.InitialCatalog += "_" + HostingEnvironment.EnvironmentName;

            if (HostingEnvironment.IsDevelopment())
            {
                connectionStringBuilder.InitialCatalog += "_" + Environment.MachineName;
            }
            y
            connectionString = connectionStringBuilder.ConnectionString;

            options.UseSqlServer(connectionString);
        });
        
        …
    }
}
```

So for example for the `appsettings.json` file

```json
{
  "ConnectionStrings": {
    "MyDbConnection": "Data Source=address.to.sql.server;Initial Catalog=MyDatabase;User Id=someuser;Password=somepassword;"
  }
}
```

You can safely develop using a single server for the whole team during development and quickly identify which system is using a database if you happen to run on a shared infrastructure, since the actual database names being used will be:

* `MyDatabase_Production`
* `MyDatabase_Staging`
* `MyDatabase_DevStaging`
* `MyDatabase_Development_MACHINEDEV1`
* `MyDatabase_Development_MACHINEDEV2`
* …