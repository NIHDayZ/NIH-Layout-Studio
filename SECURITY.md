# Security Policy

## Reporting a vulnerability

Please report suspected security vulnerabilities privately through GitHub's private vulnerability reporting for NIH Layout Studio:

https://github.com/NIHDayZ/NIH-Layout-Studio/security/advisories/new

Do not open a public issue for an undisclosed vulnerability, exposed credential, or exploit that could put users at risk.

Include enough detail to reproduce and assess the issue when practical:

- affected feature, file format, or workflow
- reproduction steps or a minimal proof of concept
- expected and observed behavior
- potential security impact
- browser and operating system, when relevant
- any suggested remediation

Please avoid including real secrets, private user files, or third-party confidential data in reports.

## Supported versions

NIH Layout Studio is under active development. Security fixes are applied to the current `main` branch and the latest published release. Older releases may not receive separate fixes.

## Scope

Security reports are especially useful for issues involving:

- unintended upload or disclosure of locally selected files
- arbitrary script execution or unsafe HTML/content rendering
- path or file-write behavior in Source mode
- maliciously crafted DayZ/Enfusion resources that escape intended parsing or rendering boundaries
- dependency or supply-chain vulnerabilities
- credential or secret exposure
- weaknesses in the hosted application's browser security controls

The application is designed to process project files locally in the browser. Reports showing an unexpected network transfer of project content are high priority.

## Coordinated disclosure

Please allow a reasonable opportunity to investigate and remediate a confirmed vulnerability before public disclosure. Once a fix is available, maintainers may coordinate disclosure details with the reporter.
