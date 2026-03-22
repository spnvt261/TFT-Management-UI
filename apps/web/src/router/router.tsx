import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShellLayout } from "@/components/layout/AppShellLayout";
import { RouteErrorBoundary } from "@/router/RouteErrorBoundary";
import DashboardRoute from "@/pages/DashboardRoute";
import MatchStakesRoute from "@/pages/MatchStakesRoute";
import GroupFundRoute from "@/pages/GroupFundRoute";
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
import NotFoundRoute from "@/pages/NotFoundRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShellLayout />,
    errorElement: <RouteErrorBoundary />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardRoute /> },
      { path: "match-stakes", element: <MatchStakesRoute /> },
      { path: "group-fund", element: <GroupFundRoute /> },
      { path: "rules", element: <RulesListRoute /> },
      { path: "rules/new", element: <RulesCreateRoute /> },
      { path: "rules/:ruleSetId", element: <RulesDetailRoute /> },
      { path: "rules/:ruleSetId/edit", element: <RulesEditRoute /> },
      { path: "rules/:ruleSetId/versions/new", element: <RulesVersionCreateRoute /> },
      { path: "rules/:ruleSetId/versions/:versionId", element: <RulesVersionDetailRoute /> },
      { path: "rules/:ruleSetId/versions/:versionId/edit", element: <RulesVersionEditRoute /> },
      { path: "players", element: <PlayersRoute /> },
      { path: "players/new", element: <PlayerCreateRoute /> },
      { path: "players/:playerId/edit", element: <PlayerEditRoute /> },
      { path: "matches/:matchId", element: <MatchDetailRoute /> },
      { path: "not-found", element: <NotFoundRoute /> },
      { path: "*", element: <NotFoundRoute /> }
    ]
  }
]);
