# Project instructions

## Releases

Follow these steps each time the human asks for a release, e.g. "release v0.5.0". Do them in this order.

1. **Set the version.** Run `npm version <x.y.z> --no-git-tag-version`. It updates `package.json` and `package-lock.json`. Commit and push the change. Keep the old version only if the human asks for it explicitly.
2. **Write the changelog.** Summarize what changed since the previous release tag (`git log <previous-tag>..HEAD`). Rules:
   - Write it for the users of the application: what they can now do or what behaves differently. Leave out internal work that users do not see, such as refactors, tests and workflow files.
   - Write it in English.
   - Group the changes under these headings, in this order: `## New features`, `## Changes`, `## Fixes`. Leave out a heading with no entries.
   - One short bullet per change.
   - Use only this markup: headings, bullet lists, bold, italic, inline code and links. No images and no raw HTML. The newer version notice of the app renders only this subset.
3. **Publish.** Create the tag `v<x.y.z>` and the GitHub Release on the commit of step 1. The changelog is the release description, e.g. `gh release create v<x.y.z> --target <commit> --title v<x.y.z> --notes-file <changelog-file>`.
