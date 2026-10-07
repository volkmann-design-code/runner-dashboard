# Security

Please report vulnerabilities privately through
[GitHub's security advisories](https://github.com/volkmann-design-code/runner-dashboard/security/advisories/new),
not in public issues.

Worth knowing when you deploy it:

- The dashboard shows repository names, branches, PR titles and authors of
  every org it watches, private repositories included. It refuses to start without
  Basic Auth unless you set `ALLOW_ANONYMOUS=true`; do that only behind a
  proxy that handles login. Serve it over HTTPS, Basic Auth sends the
  password with every request.
- `POST /api/webhook` is reachable without login. Each delivery must be
  signed with one of the configured webhook secrets and come from the org
  that secret belongs to.
- The GitHub tokens only need read access (see the README). Don't give
  them more. Note that *Contents: Read* lets a token read code; the
  dashboard only uses it for a PR's last commit and the default branch, and
  works without it (PRs then lack checks).
