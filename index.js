const path = require('path');
const shell = require('shelljs');
const fs = require('fs');
const github = require('@actions/github');
const core = require('@actions/core');

const skip = core.getInput('skip');
if (skip === 'true') {
  console.log('Skip release to github action');
  return;
}

const run = async () => {
  const filePath = core.getInput('file-path');
  const workingDirectory = core.getInput('working-directory');
  const githubToken = core.getInput('token', { required: true });
  const skipReadme = core.getInput('skip-readme');

  const cdRes = shell.cd(workingDirectory);
  if (cdRes.code !== 0) {
    throw new Error(`Failed to change directory to ${workingDirectory}`);
  }
  const [owner, repo] = process.env.GITHUB_REPOSITORY.split('/');

  shell.exec('git config --local user.name "ArcBlock Robot"');
  shell.exec('git config --local user.email "bot@arcblock.io"');

  // get blocklet version
  const file = path.join(process.cwd(), filePath);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing file at ${filePath}`);
  }
  const folderPath = path.dirname(file);
  const { version } = JSON.parse(fs.readFileSync(file, 'utf-8'));

  // upload assets to github release
  console.log(`Create release: ${owner}, repo: ${repo}, tag: v${version}`);
  const octokit = github.getOctokit(githubToken);
  const release = await octokit.repos.createRelease({
    name: `v${version}`,
    owner,
    repo,
    tag_name: `v${version}`,
  });

  console.log(`Start upload assets to release. id: ${release.data.id}, upload_url: ${release.data.upload_url}`);

  const files = fs.readdirSync(folderPath);

  try {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const file = `${folderPath}/${f}`;
      const stat = fs.statSync(file);
      const file_size = stat.size;
      const file_bytes = fs.readFileSync(file);
      console.log(`Uploading ${f}...`);
      response = await octokit.repos.uploadReleaseAsset({
        name: f,
        data: file_bytes,
        url: release.data.upload_url,
        headers: {
          'content-type': 'binary/octet-stream',
          'content-length': file_size,
        },
      });
      console.log(`Upload ${f} success`);
    }
    console.log('Upload assets success');
  } catch (err) {
    console.log('Upload assets failed');
    console.log(`Delete release: ${release.data.id}`);
    await octokit.repos.deleteRelease({
      owner,
      repo,
      release_id: release.data.id,
    });
    throw err;
  }

  if (skipReadme === 'true') {
    console.log('Skip update readme');
    return;
  }

  // update readme
  console.log('Update README.md...');
  const readme = fs.readFileSync('./README.md').toString();
  const link = `https://install.arcblock.io/launch?action=blocklet-install&meta_url=https%3A%2F%2Fgithub.com%2F${owner}%2F${repo}%2Freleases%2Fdownload%2Fv${version}%2Fblocklet.json`;
  const regex = /download%2Fv(\d+\.\d+\.\d+)%2Fblocklet\.json/;
  let newReadme;
  const paragraph = `## Launch on Blocklet Server

[![Launch on Blocklet Server](https://assets.arcblock.io/icons/launch_on_blocklet_server.svg)](${link})

`;
  if (!regex.test(readme)) {
    const index = readme.indexOf('##');
    newReadme = readme.substring(0, index) + paragraph + readme.substring(index);
  } else {
    newReadme = readme.replace(regex, `download%2Fv${version}%2Fblocklet.json`);
  }

  fs.writeFileSync('./README.md', newReadme);
  shell.exec(`git add README.md`);
  shell.exec('git commit -n -m "[skip ci] Update README.md"');
  shell.exec(`git push`);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
