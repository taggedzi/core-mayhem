# Security Policy

Core Mayhem takes security reports seriously. This is a solo-maintained project
with limited, irregular availability, so security work is handled as capacity
allows.

## Maintenance and supported versions

Security fixes are considered for the current `main` branch and the latest
release. Older releases do not receive separate security updates or backports.
Please use the latest available release, while recognizing that it may still
contain unresolved vulnerabilities.

There is no fixed maintenance schedule, dedicated security team, or emergency
response service. Reports may go unread for weeks or months. Acknowledgment,
investigation, fixes, and release dates cannot be guaranteed. Silence does not
mean a report has been reviewed or that the reported behavior is safe.

## Report a vulnerability privately

Use GitHub's [private vulnerability reporting form](https://github.com/taggedzi/core-mayhem/security/advisories/new).
You will need to sign in to GitHub. Reports submitted there are private rather
than public issues.

Please include, when available:

- A short description of the vulnerability and its potential impact.
- The affected release, commit, or deployed URL, plus browser and operating system
  when relevant.
- Reproduction steps or a small, non-destructive proof of concept.
- Any conditions required to exploit the issue and suggested fixes or workarounds.

An incomplete report is welcome; you do not need to develop an exploit to report
a credible concern. Remove credentials, personal information, and unrelated data
from examples and logs.

Do not post exploit details in public issues, discussions, or pull requests before
coordination. If the private reporting form is unavailable, open an issue asking
for a private security contact **without including vulnerability details**. This
fallback is subject to the same availability limits.

Ordinary gameplay bugs, balance concerns, and feature requests belong in the
[issue tracker](https://github.com/taggedzi/core-mayhem/issues/new/choose).

## What to expect after reporting

When available, the maintainer will assess reports based on potential harm and
the information provided. A response may request more details, suggest a
workaround, propose a fix, or explain why the report is outside the project's
scope. A valid report does not guarantee that a fix can be delivered.

Please keep follow-up information in the original private report. Repeated
reports or messages across multiple channels do not speed up review. There is
no paid bug bounty or guaranteed reward.

Please coordinate public disclosure through the private report when possible.
There is no fixed disclosure deadline, and this policy does not ask researchers
to keep findings private indefinitely. If you plan to publish, share your
intended date in the report so the maintainer has an opportunity to respond;
a response before that date cannot be promised.

## Scope and safe testing

Reports may cover this repository's game code, dependency usage, build and
release workflows, or the official hosted game. For third-party vulnerabilities,
report to the upstream project as appropriate and explain any Core Mayhem impact
in a private report here.

Test on your own local checkout whenever possible. Do not access other people's
data, disrupt shared services, run denial-of-service tests against the hosted
game, or probe third-party services without their permission. This policy does
not authorize testing infrastructure owned by hosting providers or other parties.

Optional Ollama connections and independently hosted copies are operated by their
owners. Keep those services appropriately restricted and updated; the project
cannot maintain or secure someone else's deployment. If a known issue affects
your setup and no fix is available, disable the affected integration or stop
using that deployment until you can address it.
