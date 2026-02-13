import { createBrowserRouter } from "react-router";
import { AppLayout } from "./AppLayout";
import { lazy, Suspense } from "react";
import { Skeleton } from "@/shared/ui";

const HomePage = lazy(() => import("@/pages/home/ui/HomePage"));
const PostDetailPage = lazy(() => import("@/pages/post-detail/ui/PostDetailPage"));
const PostEditorPage = lazy(() => import("@/pages/post-editor/ui/PostEditorPage"));
const ProfilePage = lazy(() => import("@/pages/profile/ui/ProfilePage"));
const CategoryDetailPage = lazy(() => import("@/pages/category-detail/ui/CategoryDetailPage"));
const LoginPage = lazy(() => import("@/pages/login/ui/LoginPage"));
const AdminPage = lazy(() => import("@/pages/admin/ui/AdminPage"));
const SettingsPage = lazy(() => import("@/pages/settings-profile/ui/SettingsPage"));
const NotFoundPage = lazy(() => import("@/pages/not-found/ui/NotFoundPage"));

function PageLoader() {
  return <div className="flex flex-col gap-4 p-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /><Skeleton className="h-4 w-96" /></div>;
}

function withSuspense(Component: React.LazyExoticComponent<() => JSX.Element>) {
  return <Suspense fallback={<PageLoader />}><Component /></Suspense>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: withSuspense(HomePage) },
      { path: "posts/:slug", element: withSuspense(PostDetailPage) },
      { path: "write", element: withSuspense(PostEditorPage) },
      { path: "write/:id", element: withSuspense(PostEditorPage) },
      { path: "profile", element: withSuspense(ProfilePage) },
      { path: "category/:slug", element: withSuspense(CategoryDetailPage) },
      { path: "login", element: withSuspense(LoginPage) },
      { path: "admin", element: withSuspense(AdminPage) },
      { path: "settings", element: withSuspense(SettingsPage) },
      { path: "*", element: withSuspense(NotFoundPage) },
    ],
  },
]);
