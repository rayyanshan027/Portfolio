# Rayyan Shan — Portfolio

Personal portfolio website for Rayyan Shan, a software developer and machine learning engineer based in Edmonton, Canada.

The site highlights production AI work, full-stack projects, professional experience, technical skills, education, and research.

## Live Site

The recommended GitHub Pages URL is:

`https://rayyanshan027.github.io`

The custom domain can later be connected at:

`https://rayyanshan.dev`

## Built With

- Semantic HTML5
- Modern responsive CSS
- Google Fonts
- GitHub Actions
- GitHub Pages

No build tools or JavaScript dependencies are required.

## Run Locally

From the project directory, start a local server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy to GitHub Pages

### 1. Create the repository

For the cleanest free URL, create a **public** repository named:

`rayyanshan027.github.io`

### 2. Initialize and push the project

```bash
git init
git add .
git commit -m "Launch portfolio website"
git branch -M main
git remote add origin https://github.com/rayyanshan027/rayyanshan027.github.io.git
git push -u origin main
```

### 3. Enable GitHub Pages

In the GitHub repository:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Open the **Actions** tab and wait for the `Deploy portfolio to GitHub Pages` workflow to finish.
4. Visit `https://rayyanshan027.github.io`.

Every push to `main` automatically publishes the latest version.

## Connect `rayyanshan.dev`

After purchasing the domain:

1. Open **Settings → Pages** in the GitHub repository.
2. Enter `rayyanshan.dev` under **Custom domain** and save.
3. Add the DNS records GitHub provides through the domain registrar.
4. Enable **Enforce HTTPS** after GitHub provisions the certificate.

Do not add a `CNAME` file until the domain is owned and ready to connect.

## Project Structure

```text
.
├── .github/workflows/deploy-pages.yml
├── assets/
│   ├── cyan-homepage.png
│   └── finley-benchmark.svg
├── index.html
└── styles.css
```

## Contact

- Email: [rayyanshan027@gmail.com](mailto:rayyanshan027@gmail.com)
- GitHub: [rayyanshan027](https://github.com/rayyanshan027)
- LinkedIn: [Rayyan Shan](https://www.linkedin.com/in/rayyan-shan-65a637239/)

