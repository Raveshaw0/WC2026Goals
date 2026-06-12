# deploy/sbs-links.yml

This is the GitHub Actions workflow for SBS link discovery. It belongs at
`.github/workflows/sbs-links.yml`, but the push token for this repo lacks the
`workflow` scope, so GitHub refuses to accept it via git push.

To activate it, either:

1. On github.com, open this repo, press "Add file", create
   `.github/workflows/sbs-links.yml`, and paste this file's contents (web UI
   uses your login, not the token), or
2. Add the `workflow` scope to the personal access token and push the file
   from a local clone.

The app works without it: the home page lazily triggers `/api/check-sbs` on
every load. The workflow is only the backstop for periods when nobody opens
the site.
