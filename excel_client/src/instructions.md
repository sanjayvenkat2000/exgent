**Role:** Act as a Senior Frontend Engineer specializing in React, TypeScript, and modern state management.

**Task:** Initialize a React 18+ application with a specific provider nesting structure and a centralized routing architecture.

**Technical Stack:**

* **UI Framework:** Radix UI Themes (`@radix-ui/themes`)
* **Data Fetching:** TanStack Query (`@tanstack/react-query`)
* **Routing:** React Router v6+ using `createBrowserRouter`
* **Language:** TypeScript (.tsx)

**Requirements:**

**1. Entry Point (`main.tsx`):**

* Initialize the `QueryClient`.
* Wrap the application in the following order: `StrictMode` > `QueryClientProvider` > `Theme` (from Radix UI).
* Import Radix UI styles (`@radix-ui/themes/styles.css`) and a local `index.css`.
* Include placeholders/imports for custom domain providers: `ServiceProvider` and `ChatStreamProvider` from a `./domain` directory, even if they are ready for future use in the provider tree.

**2. Application Structure & Routing (`App.tsx`):**

* Use the **Data Router** pattern (`createBrowserRouter`).
* Create a layout component named `AppLayout` that renders a `<Header />` component and an `<Outlet />` wrapped in a `<main>` tag with the class `app-content`.
* Define the following routes within the `AppLayout` children:
* `/`: Renders `<Welcome />`


* The `App` component should return the `RouterProvider`.

**3. Project Organization:**
* Assume the following file structure for imports:
* Components: `./components/Header`
* Pages: `./pages/Welcome`, `./pages/SchemaDetailLoader`, `./pages/ExcelChat`
* Domain/Context: `./domain/service` and `./domain/ChatStreamProvider`



