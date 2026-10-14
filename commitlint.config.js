// Commit message rules. See "Commit messages" in CONTRIBUTING.md.
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Dependabot titles with long package names can exceed 72 characters.
    "header-max-length": [2, "always", 100],
    // Bodies and footers are prose, written one paragraph per line.
    "body-max-line-length": [0],
    "footer-max-line-length": [0],
    "scope-enum": [
      1,
      "always",
      [
        "compat",
        "routes",
        "runtime",
        "tooling",
        "skills",
        "deps",
        "deps-dev",
        "release",
      ],
    ],
  },
};
