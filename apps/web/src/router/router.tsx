import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShellLayout } from "@/components/layout/AppShellLayout";
import { RouteErrorBoundary } from "@/router/RouteErrorBoundary";
import { RequireAdminRoute } from "@/router/ProtectedRoute";
import DashboardRoute from "@/pages/DashboardRoute";
import MatchStakesRoute from "@/pages/MatchStakesRoute";
import MatchStakesCreateRoute from "@/pages/MatchStakesCreateRoute";
import GroupFundRoute from "@/pages/GroupFundRoute";
import GroupFundCreateRoute from "@/pages/GroupFundCreateRoute";
import RulesListRoute from "@/pages/RulesListRoute";
import RulesCreateRoute from "@/pages/RulesCreateRoute";
import RulesDetailRoute from "@/pages/RulesDetailRoute";
import RulesEditRoute from "@/pages/RulesEditRoute";
import RulesVersionCreateRoute from "@/pages/RulesVersionCreateRoute";
import RulesVersionDetailRoute from "@/pages/RulesVersionDetailRoute";
import RulesVersionEditRoute from "@/pages/RulesVersionEditRoute";
import PlayersRoute from "@/pages/PlayersRoute";
import PlayerCreateRoute from "@/pages/PlayerCreateRoute";
import PlayerEditRoute from "@/pages/PlayerEditRoute";
import MatchDetailRoute from "@/pages/MatchDetailRoute";
import SettingsRoute from "@/pages/SettingsRoute";
import NotFoundRoute from "@/pages/NotFoundRoute";
import LoginRoute from "@/pages/LoginRoute";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginRoute />
  },
  {
    path: "/",
    element: <AppShellLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/match-stakes" replace /> },
      { path: "dashboard", element: <DashboardRoute /> },
      { path: "match-stakes", element: <MatchStakesRoute /> },
      {
        path: "match-stakes/new",
        element: (
          <RequireAdminRoute fallbackTo="/match-stakes">
            <MatchStakesCreateRoute />
          </RequireAdminRoute>
        )
      },
      { path: "group-fund", element: <Navigate to="/group-fund/fund" replace /> },
      { path: "group-fund/fund", element: <GroupFundRoute /> },
      {
        path: "group-fund/new",
        element: (
          <RequireAdminRoute fallbackTo="/group-fund/fund">
            <GroupFundCreateRoute />
          </RequireAdminRoute>
        )
      },
      { path: "rules", element: <RulesListRoute /> },
      {
        path: "rules/new",
        element: (
          <RequireAdminRoute fallbackTo="/rules">
            <RulesCreateRoute />
          </RequireAdminRoute>
        )
      },
      { path: "rules/:ruleSetId", element: <RulesDetailRoute /> },
      {
        path: "rules/:ruleSetId/edit",
        element: (
          <RequireAdminRoute fallbackTo="/rules">
            <RulesEditRoute />
          </RequireAdminRoute>
        )
      },
      {
        path: "rules/:ruleSetId/versions/new",
        element: (
          <RequireAdminRoute fallbackTo="/rules">
            <RulesVersionCreateRoute />
          </RequireAdminRoute>
        )
      },
      { path: "rules/:ruleSetId/versions/:versionId", element: <RulesVersionDetailRoute /> },
      {
        path: "rules/:ruleSetId/versions/:versionId/edit",
        element: (
          <RequireAdminRoute fallbackTo="/rules">
            <RulesVersionEditRoute />
          </RequireAdminRoute>
        )
      },
      { path: "players", element: <PlayersRoute /> },
      {
        path: "players/new",
        element: (
          <RequireAdminRoute fallbackTo="/players">
            <PlayerCreateRoute />
          </RequireAdminRoute>
        )
      },
      {
        path: "players/:playerId/edit",
        element: (
          <RequireAdminRoute fallbackTo="/players">
            <PlayerEditRoute />
          </RequireAdminRoute>
        )
      },
      { path: "matches/:matchId", element: <MatchDetailRoute /> },
      { path: "settings", element: <SettingsRoute /> },
      { path: "not-found", element: <NotFoundRoute /> },
      { path: "*", element: <NotFoundRoute /> }
    ]
  }
]);
