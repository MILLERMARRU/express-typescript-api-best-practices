# Publishing Your Skill to skills.sh

## Prerequisites

1. **GitHub Account** - You'll need a GitHub repository for your skill
2. **Git** - Installed and configured on your machine
3. **Skill Content** - Your SKILL.md file and optional references/scripts/assets

## Step-by-Step Publishing Guide

### 1. Create GitHub Repository

```bash
# Create a new repository on GitHub
# Go to: https://github.com/new

# Repository name: express-typescript-api-best-practices
# Description: Professional REST API best practices for Express + TypeScript
# Public visibility (required for skills.sh)
```

### 2. Initialize Local Repository

```bash
# Navigate to your skill directory
cd express-typescript-api-best-practices

# Initialize git
git init

# Add all files
git add .

# Create initial commit
git commit -m "feat: initial skill release - Express TypeScript API best practices

- Layered architecture with SOLID principles
- JWT authentication with Argon2 password hashing
- Role-based authorization (RBAC)
- Transaction management patterns
- Input validation with Zod
- OpenAPI/Swagger documentation
- Error handling strategies
- Performance optimization techniques
- Comprehensive reference documentation
- Code generation scripts"

# Add remote origin
git remote add origin https://github.com/MILLERMARRU/express-typescript-api-best-practices.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 3. Repository Structure

Your repository should look like this:

```
express-typescript-api-best-practices/
├── SKILL.md                    # ✅ REQUIRED - Main skill file
├── README.md                   # ✅ REQUIRED - GitHub README
├── LICENSE                     # ✅ REQUIRED - MIT License
├── PUBLISHING.md              # This file
├── references/                # Optional - Detailed docs
│   ├── architecture.md
│   ├── transactions.md
│   ├── auth-rbac.md
│   ├── validation.md
│   ├── error-handling.md
│   └── performance.md
├── scripts/                   # Optional - Utility scripts
│   └── generate-endpoint.ts
└── assets/                    # Optional - Templates
    └── starter-template.md
```

### 4. Optimize SKILL.md for Discovery

Your SKILL.md frontmatter is CRITICAL for discoverability:

```yaml
---
name: express-typescript-api-best-practices
description: Professional-grade REST API architecture with Express.js and TypeScript following SOLID principles, layered architecture, transaction management, JWT authentication with role-based authorization (RBAC), input validation with Zod, OpenAPI/Swagger documentation, standardized response format, and production-ready patterns. Use when building or refactoring REST APIs with Express + TypeScript that require enterprise-level code quality, maintainability, scalability, and security.
---
```

**Description Best Practices:**
- ✅ Include WHAT it does (REST API architecture)
- ✅ Include HOW it works (SOLID principles, JWT, Zod, etc.)
- ✅ Include WHEN to use it (building/refactoring APIs)
- ✅ Include key technologies (Express, TypeScript)
- ✅ Use keywords users will search for (JWT, RBAC, validation, etc.)

### 5. Create Releases (Optional but Recommended)

```bash
# Tag your first release
git tag -a v1.0.0 -m "Release v1.0.0

Initial release with:
- Complete layered architecture guide
- JWT authentication & RBAC
- Transaction management patterns
- Zod validation examples
- Error handling strategies
- Performance optimization techniques"

# Push tags
git push origin v1.0.0

# Or create a release on GitHub UI:
# https://github.com/MILLERMARRU/express-typescript-api-best-practices/releases/new
```

### 6. Automatic Indexing

**skills.sh automatically indexes public GitHub repositories!**

Once your repository is public and contains a valid `SKILL.md` file:

1. **Wait 24-48 hours** for automatic indexing
2. **Or request manual indexing** (if available on skills.sh)
3. **Search for your skill** at https://skills.sh/

Your skill will be accessible via:
```bash
npx skills add MILLERMARRU/express-typescript-api-best-practices
```

### 7. Verify Installation

Test that your skill can be installed:

```bash
# In a test directory
npx skills add MILLERMARRU/express-typescript-api-best-practices

# Check installation
ls ~/.claude/skills/
# Should show your skill directory
```

### 8. Promote Your Skill

Once published, promote your skill:

1. **Add to your GitHub profile README**
2. **Share on social media** (Twitter, LinkedIn, Dev.to)
3. **Post in Claude community forums**
4. **Add badges to README**:

```markdown
[![Skills.sh](https://img.shields.io/badge/skills.sh-install-blue)](https://skills.sh/MILLERMARRU/express-typescript-api-best-practices)
[![GitHub stars](https://img.shields.io/github/stars/MILLERMARRU/express-typescript-api-best-practices)](https://github.com/MILLERMARRU/express-typescript-api-best-practices)
```

## Updating Your Skill

```bash
# Make changes to your skill
git add .
git commit -m "feat: add new validation patterns"

# Tag new version
git tag -a v1.1.0 -m "Release v1.1.0 - Add validation patterns"

# Push changes and tags
git push origin main
git push origin v1.1.0
```

Users can update with:
```bash
npx skills update MILLERMARRU/express-typescript-api-best-practices
```

## Best Practices for Skill Maintenance

### 1. Semantic Versioning

Follow [SemVer](https://semver.org/):
- **v1.0.0** → **v1.0.1** (patch: bug fixes, typos)
- **v1.0.0** → **v1.1.0** (minor: new features, backward compatible)
- **v1.0.0** → **v2.0.0** (major: breaking changes)

### 2. Keep CHANGELOG.md

```markdown
# Changelog

## [1.1.0] - 2026-02-06
### Added
- New validation patterns for file uploads
- Redis caching examples

### Fixed
- Typo in transaction example

## [1.0.0] - 2026-02-05
### Added
- Initial release
```

### 3. Respond to Issues

Enable GitHub Issues and respond to:
- Bug reports
- Feature requests
- Documentation improvements
- Questions

### 4. Accept Contributions

Create `CONTRIBUTING.md`:

```markdown
# Contributing

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-pattern`)
3. Make your changes
4. Test your changes
5. Commit with descriptive message
6. Push to your fork
7. Open a Pull Request

## Guidelines

- Follow existing code style
- Update README if adding new features
- Add examples for new patterns
- Keep SKILL.md concise (use references/ for details)
```

### 5. Add Examples

The more examples, the better:
- Real-world use cases
- Before/after comparisons
- Common pitfalls to avoid
- Performance benchmarks

## Troubleshooting

### Skill Not Showing on skills.sh

1. **Check SKILL.md format**:
   - Valid YAML frontmatter
   - Required `name` and `description` fields

2. **Check repository visibility**: Must be PUBLIC

3. **Wait for indexing**: Can take 24-48 hours

4. **Check file location**: SKILL.md must be in root or `/skills/` folder

### Installation Fails

1. **Check repository URL**: Must be accessible
2. **Verify SKILL.md exists**: In correct location
3. **Check network**: Firewall/proxy issues

## Success Metrics

Track your skill's success:

1. **GitHub Stars** - Popularity indicator
2. **Install Count** - On skills.sh leaderboard
3. **Forks** - Community engagement
4. **Issues/PRs** - Active maintenance
5. **Downloads** - npx skills analytics (if available)

## Marketing Your Skill

### Write a Blog Post

```markdown
# Building Enterprise REST APIs with Express + TypeScript

I just published a comprehensive skill for Claude Code that teaches
professional REST API development...

[Link to your skill]
```

### Create a Demo Video

- Show skill installation
- Demonstrate code generation
- Highlight key features

### Submit to Showcases

- Claude community showcases
- Dev.to articles
- Reddit r/ClaudeAI
- Hacker News Show HN

## License Recommendation

Use **MIT License** for maximum adoption:

```markdown
MIT License

Copyright (c) 2026 Miller Marru

Permission is hereby granted, free of charge, to any person obtaining a copy...
```

## Support & Feedback

- **Email**: Millermarru4@gamil.com
- **GitHub Issues**: https://github.com/MILLERMARRU/express-typescript-api-best-practices/issues


---

**Good luck publishing your skill! 🚀**

If you found this guide helpful, please star the repository and share with others!
