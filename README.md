# action-release-to-github

Use github action to release blocklet to Github Release

Example workflow

```yml
on:
  push:
    # Sequence of patterns matched against refs/tags
    tags:
      - 'v*' # Push events to matching v*, i.e. v1.0, v20.15.10

name: Create Release

jobs:
  Deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v2
      - name: Build
        run: <build_your_blocklet> # after build, use `abtnode bundle --create-release` to bundle your blocklet
      - name: Release to Github
        uses: blocklet/action-release-to-github@v1.0.0
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
```