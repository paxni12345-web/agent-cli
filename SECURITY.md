# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take the security of Agent CLI seriously. If you believe you have found a security vulnerability, please report it to us responsibly.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **Email**: Send details to security@agent-cli.dev
2. **GitHub Security Advisory**: Use the [GitHub Security Advisory](https://github.com/yourusername/agent-cli/security/advisories/new) feature

### What to Include

Please include the following information in your report:

- Type of vulnerability
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it
- Any potential mitigations you've identified

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Varies by severity
  - Critical: 1-7 days
  - High: 7-30 days
  - Medium: 30-90 days
  - Low: Next release cycle

### Disclosure Policy

- Security issues will be publicly disclosed after a fix is released
- We will credit security researchers who responsibly disclose vulnerabilities
- We may request a coordinated disclosure timeline

## Security Best Practices

### For Users

1. **API Keys**: Never commit API keys to version control
   ```bash
   # Use environment variables
   export ANTHROPIC_API_KEY=your-key-here
   export OPENAI_API_KEY=your-key-here
   ```

2. **Permission Mode**: Use appropriate permission modes
   - `safe`: For production/untrusted environments
   - `normal`: For development (default)
   - `auto`: For trusted automation
   - `dangerous`: Only in fully controlled environments

3. **Workspace Isolation**: Run agents in isolated directories
   ```bash
   # Create isolated workspace
   mkdir /tmp/agent-workspace
   cd /tmp/agent-workspace
   agent run
   ```

4. **Input Validation**: Validate all user inputs before passing to agent

5. **Regular Updates**: Keep Agent CLI updated
   ```bash
   npm update agent-cli
   ```

### For Developers

1. **Input Sanitization**: Always sanitize and validate inputs
   ```typescript
   // Good
   if (!input.path || typeof input.path !== 'string') {
     return { success: false, error: 'Invalid path' };
   }
   
   // Validate path doesn't escape workspace
   const normalizedPath = path.normalize(input.path);
   if (normalizedPath.startsWith('..')) {
     return { success: false, error: 'Path outside workspace' };
   }
   ```

2. **Permission Checks**: Always check permissions before sensitive operations
   ```typescript
   const allowed = await context.permissions.requestPermission(
     'write_file',
     { path: input.path }
   );
   if (!allowed) {
     return { success: false, error: 'Permission denied' };
   }
   ```

3. **Error Handling**: Don't expose sensitive information in errors
   ```typescript
   // Bad
   catch (error) {
     throw new Error(`Failed: ${JSON.stringify(secretData)}`);
   }
   
   // Good
   catch (error) {
     logger.error('Operation failed', { sanitizedContext });
     throw new Error('Operation failed');
   }
   ```

4. **Secrets Management**: Never log or expose secrets
   ```typescript
   // Bad
   console.log(`API Key: ${apiKey}`);
   
   // Good
   console.log('API Key: [REDACTED]');
   ```

5. **Dependency Security**: Regularly audit dependencies
   ```bash
   npm audit
   npm audit fix
   ```

## Known Security Considerations

### 1. AI Provider API Keys

**Risk**: API keys provide access to AI services and may incur costs.

**Mitigation**:
- Store keys in environment variables
- Never commit keys to version control
- Use `.gitignore` for sensitive files
- Rotate keys regularly
- Use provider's API key restrictions (IP allowlists, etc.)

### 2. File System Access

**Risk**: Agent can read/write files in workspace.

**Mitigation**:
- All file operations are restricted to workspace root
- Path traversal attacks are prevented
- Permission system controls dangerous operations
- Use `safe` or `normal` permission mode

### 3. Shell Command Execution

**Risk**: Shell tool can execute arbitrary commands.

**Mitigation**:
- Requires user permission in `safe` and `normal` modes
- Command injection prevention
- Workspace isolation
- Command validation and sanitization

### 4. Code Generation

**Risk**: AI-generated code may contain vulnerabilities.

**Mitigation**:
- Always review generated code before execution
- Run security scanners on generated code
- Use code analysis tools
- Test thoroughly before deployment

### 5. Data Privacy

**Risk**: User data sent to AI providers.

**Mitigation**:
- Review AI provider's privacy policy
- Don't include sensitive data in prompts
- Use local models for sensitive operations
- Be aware of data retention policies

## Security Features

### 1. Permission System

Four permission modes to control agent behavior:

- **Safe**: Prompts for every action
- **Normal**: Prompts for risky actions (default)
- **Auto**: Auto-approves safe actions
- **Dangerous**: Auto-approves all (use with caution)

### 2. Workspace Isolation

All file operations are restricted to the configured workspace root.

### 3. Input Validation

All tool inputs are validated against JSON schemas.

### 4. Path Sanitization

Prevents directory traversal attacks:
```typescript
// Blocked: ../../../etc/passwd
// Blocked: /etc/passwd
// Allowed: src/file.ts
```

### 5. Error Sanitization

Sensitive information is not exposed in error messages.

## Security Audit

Last security audit: [Date]
Conducted by: [Organization/Individual]

### Audit Scope
- Code review
- Dependency analysis
- Permission system
- Input validation
- Error handling

## Compliance

Agent CLI follows these security standards:

- OWASP Top 10
- CWE/SANS Top 25
- Node.js Security Best Practices
- npm Security Guidelines

## Security Contacts

- **Security Team**: security@agent-cli.dev
- **Maintainer**: maintainer@agent-cli.dev
- **Security Advisory**: GitHub Security Advisories

## Bug Bounty

We currently do not have a formal bug bounty program, but we recognize and appreciate security researchers who responsibly disclose vulnerabilities.

Recognition:
- Public acknowledgment (if desired)
- Security Hall of Fame entry
- Contributor credit in release notes

## Updates

This security policy may be updated periodically. Check back regularly for updates.

**Last Updated**: 2026-08-30
**Version**: 1.0

---

## Security Hall of Fame

We thank the following researchers for responsibly disclosing security issues:

<!-- To be populated as issues are found and fixed -->

---

**Remember**: Security is everyone's responsibility. If you see something, say something.
