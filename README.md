# ECE1724 Project

This project uses Next.js, React, TypeScript, and Tailwind CSS. The current homepage is a simple **Hello world** placeholder.

## First-time setup (no web development experience needed)

### 1. Install Node.js 24

Download and install **version 24 LTS** from [the official Node.js website](https://nodejs.org/en/download). Choose version 24 in the version selector even if a newer version is shown first. Choose the installer for your laptop and include **npm**, which installs the project's packages.

Close and reopen your terminal after installation. A terminal is the app where you type commands: **Terminal** on macOS/Linux or **Command Prompt / Windows Terminal** on Windows.

### 2. Download the project

On this project's GitHub page, choose **Code → Download ZIP**, then extract the ZIP completely. You can also clone the repository if you already use Git. Open the extracted project folder: it should contain `package.json`, `setup.command`, and `setup.cmd`.

### 3. Run setup

| Your laptop | What to do |
| --- | --- |
| macOS | Double-click `setup.command`. If it cannot open, open Terminal in the project folder and run `sh setup.command`. |
| Windows | Double-click `setup.cmd` in the extracted folder. |
| Linux | Open a terminal in the project folder and run `npm run setup`. |

The same terminal command also works on macOS and Windows:

```bash
npm run setup
```

To open a terminal in the right folder, use your editor's **Open Folder** and then **Terminal → New Terminal**. Alternatively, type `cd ` followed by the project folder's path, putting the path in double quotes if it contains spaces.

Setup checks Node.js and npm, installs the exact packages listed in `package-lock.json`, and starts the app. An internet connection is needed for installation and the first run, including downloading the starter's Google fonts. No Vercel login, PostgreSQL installation, Docker, or credentials are required for this placeholder.

### 4. Open the app

Wait until the terminal says **Ready**, then open the **Local** address it prints, normally [http://127.0.0.1:3000](http://127.0.0.1:3000). You should see **Hello world**.

If another program uses port 3000, Next.js normally chooses the next available port. Always use the address printed in your terminal.

Keep the terminal open while using the app. Press **Ctrl+C** to stop it.

## Frontend and backend

Next.js runs the frontend and its server-side code together. **You only need one command and one terminal**; there is no separate backend server to install or start.

- The frontend homepage is in `app/page.tsx`.
- Backend API routes can later be added under `app/api/.../route.ts`; the same development server runs them.
- The current starter has no custom API endpoints, database features, or upload features yet. This script starts the existing application; it does not provision cloud services.

An existing `.env.local` is left untouched. New laptops do not need that file for Hello world. If future features need credentials, get development credentials from the project owner and keep them in `.env.local`, which is ignored by Git. The `docs/` folder is also ignored and is not required to run the app.

## Everyday use

After the first setup, open a terminal in the project folder and run:

```bash
npm run dev
```

Edit `app/page.tsx` and save; the browser updates automatically. Stop the server with **Ctrl+C**. If a teammate changes the project's dependencies, stop the server and run `npm run setup` again to reinstall them.

Other useful commands:

```bash
npm run setup -- --install-only   # Install packages without starting the app
npm run setup -- --port 3002      # Install and start on a specific port
npm run dev -- --port 3002        # Start on that port without reinstalling
npm run lint                     # Check code style and common mistakes
npm run build                    # Check that a production build succeeds
```

The launchers can be run from any working directory. The `npm run ...` commands must be run from the folder containing `package.json`. Setup intentionally does not change your system settings or install Node.js for you.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| `node` or `npm` is not recognized / not found | Install Node.js 24 with npm, then close and reopen the terminal. Check with `node --version` and `npm --version`. |
| The wrong Node.js version | Install/select Node.js 24. If you use nvm, run `nvm install` and `nvm use` in the project folder. |
| `npm.ps1 cannot be loaded` on Windows | Use `setup.cmd`, Command Prompt, or `npm.cmd run setup` in PowerShell. No execution-policy change is needed. |
| `package.json` cannot be found | Extract the ZIP and open a terminal in the project folder, not its parent folder. |
| Server already running | Use its existing browser page, or press Ctrl+C in that project's running terminal before running setup again. Setup refuses to reinstall packages while it detects an active development server. |
| Server lock after a crash | Close any running server for this project first. If the problem remains, delete only the generated `.next` folder in this project and rerun setup. Next.js will recreate it. |
| A specific port is busy | Use the next available port, for example `npm run setup -- --port 3002`. |
| Package download or font download fails | Check your internet connection, proxy, or VPN, then retry. If it persists, share the error message with a teammate. |
| Browser says it cannot connect | Keep the terminal running and use its printed Local address. Check the terminal for errors. |

If setup fails, it stops and prints a next step. It does not overwrite `.env.local` or change the dependency versions to try to fix the error.
