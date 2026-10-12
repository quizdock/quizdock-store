# Publish your quizzes and themes to the QuizDock community store

> Submissions are not open yet. This guide describes how it will work.

You need a GitHub account and [QuizDock](https://github.com/quizdock/quizdock). No git, no command line.

**Before you start (once)**

1. Create a GitHub account.
2. Open [quizdock/quizdock-extensions](https://github.com/quizdock/quizdock-extensions) → **Use this template** → **Create a new repository**. Name it **`quizdock-extensions`** and keep it **Public**.

**Publish a quiz**

1. In QuizDock, open your quiz and choose **Export for publication**. It checks your quiz, lets you confirm its short name, and gives you a `.quizdock.zip` file.
2. **Unzip** it on your computer (double-click it, or right-click → *Extract all*). You get a folder.
3. In your repository, open the **quizzes** folder, click **Add file → Upload files**, drag **the whole folder** onto the page, then **Commit changes**.
4. A green check means it is published. A red cross links to a message saying what to fix in QuizDock.

**Publish a theme**

1. In QuizDock, open **Themes**, open your theme and choose **Export**. Give it a licence the store accepts (CC0, CC BY or CC BY-SA); a font you imported needs its own licence (OFL, CC0, CC BY or CC BY-SA).
2. **Unzip** the `.quizdock-theme.zip` file.
3. In your repository, open the **themes** folder (create it with **Add file → Upload files** the first time), drag **the whole folder** onto the page, then **Commit changes**.
4. The same green check or red cross tells you how it went.

**Join the store (once, after your first green check)**

Fill in the [registration form](https://github.com/quizdock/quizdock-store/issues/new?template=register.yml). A maintainer looks at your quizzes, usually within a week. After that, everything you publish appears in the store.

**Update a quiz or a theme:** export it again, unzip it, and upload the folder over the old one (delete the old folder if its name differs). **Remove it:** delete its folder.

> ⚠️ **You are responsible for every image, icon, sound and video you publish.**
> Only use media you made yourself, or media under an open licence that allows
> reuse (CC0, CC BY, CC BY-SA; avoid "NC" and "ND"), and credit them in QuizDock.
> Reliable sources: [Wikimedia Commons](https://commons.wikimedia.org),
> [Openverse](https://openverse.org), [Freesound](https://freesound.org)
> (check each sound's licence), [NASA Image Library](https://images.nasa.gov).
> A quiz reported for infringing media is removed.

**Media:** export from QuizDock, which makes them light. If your browser can't convert a file, prepare it with the tool of your choice before adding it to QuizDock.

**Good to know:**
- Nobody checks that the answers are right.
- A removed quiz is no longer offered, but copies already imported stay.
