#!/usr/bin/env bash

cd "$( dirname "${BASH_SOURCE[0]}" )"

git push origin `git subtree split --prefix public master`:master --force