## Description

<!-- Provide a clear and concise description of what this PR does -->

## Type of Change

<!-- Mark the relevant option with an "x" -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🎨 Code style update (formatting, renaming)
- [ ] ♻️ Code refactoring (no functional changes)
- [ ] ⚡️ Performance improvement
- [ ] ✅ Test update
- [ ] 🔧 Build/CI configuration change
- [ ] 🔒 Security fix

## Related Issue

<!-- Link to the issue this PR addresses -->

Fixes #(issue number)

## Changes Made

<!-- List the key changes made in this PR -->

- Change 1
- Change 2
- Change 3

## Testing

<!-- Describe the tests you ran and how to reproduce them -->

### Test Configuration

- Node version:
- OS:
- Test files added/modified:

### Tests Performed

- [ ] Unit tests pass locally
- [ ] Integration tests pass locally
- [ ] Manually tested the changes
- [ ] Added new tests for new features/fixes

### Test Commands

```bash
npm test
npm run test:coverage
```

## Screenshots/Recordings

<!-- If applicable, add screenshots or recordings to demonstrate the changes -->

## Checklist

<!-- Mark completed items with an "x" -->

### Code Quality

- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have added JSDoc comments for public APIs
- [ ] My changes generate no new warnings or errors
- [ ] I have removed any console.log or debug code

### Testing

- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
- [ ] I have added integration tests where appropriate
- [ ] Test coverage has not decreased

### Documentation

- [ ] I have updated the documentation accordingly
- [ ] I have updated the README.md if needed
- [ ] I have updated the API.md documentation
- [ ] I have added/updated code examples if applicable

### Dependencies

- [ ] I have not added unnecessary dependencies
- [ ] All new dependencies are properly documented
- [ ] Package.json and package-lock.json are in sync

### Security

- [ ] My changes do not introduce security vulnerabilities
- [ ] I have considered edge cases and error handling
- [ ] Sensitive data is not exposed in logs or errors
- [ ] Input validation is implemented where needed

## Breaking Changes

<!-- If this is a breaking change, describe the impact and migration path -->

**Impact:**
<!-- Describe what breaks and why -->

**Migration Guide:**
<!-- Provide step-by-step instructions for users to migrate -->

```typescript
// Before
oldCode();

// After
newCode();
```

## Additional Notes

<!-- Any additional information that reviewers should know -->

## Reviewer Checklist

<!-- For maintainers reviewing this PR -->

- [ ] Code quality is acceptable
- [ ] Tests are comprehensive
- [ ] Documentation is updated
- [ ] No security concerns
- [ ] Performance impact is acceptable
- [ ] Breaking changes are well documented
- [ ] Commit messages follow conventional commits

---

**By submitting this PR, I confirm that:**

- [ ] I have read and followed the [Contributing Guidelines](../CONTRIBUTING.md)
- [ ] My contributions are made under the MIT License
- [ ] I agree to the project's Code of Conduct
