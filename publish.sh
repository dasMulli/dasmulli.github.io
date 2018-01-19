#!/usr/bin/env bash

cd "$( dirname "${BASH_SOURCE[0]}" )"

git subtree push --prefix public origin master

# use this instead when --force is necessary
#git push origin `git subtree split --prefix public master`:master --force
