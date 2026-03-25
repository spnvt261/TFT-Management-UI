import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { App as AntdApp, ConfigProvider, message } from "antd";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/api/queryClient";
import { router } from "@/router/router";
import { AuthProvider } from "@/features/auth/AuthContext";
import "@/app/styles.css";

message.config({
  top: 20,
  maxCount: 3
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#14532d",
          borderRadius: 12,
          fontFamily: "'Plus Jakarta Sans', sans-serif"
        }
      }}
    >
      <AntdApp>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </QueryClientProvider>
      </AntdApp>
    </ConfigProvider>
  </React.StrictMode>
);
