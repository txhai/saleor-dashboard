import useNavigator from "@saleor/hooks/useNavigator";
import useUser from "@saleor/hooks/useUser";
import React from "react";

import LoginPage, { FormData } from "../components/LoginPage";
import { passwordResetUrl } from "../urls";

const LoginView: React.FC = () => {
  const navigate = useNavigator();
  const { captcha, login, user, tokenAuthLoading } = useUser();

  const handleSubmit = (data: FormData, recaptchaToken: string) => {
    captcha(recaptchaToken);
    login(data.email, data.password);
  };

  return (
    <LoginPage
      error={user === null}
      disableLoginButton={tokenAuthLoading}
      onPasswordRecovery={() => navigate(passwordResetUrl)}
      onSubmit={handleSubmit}
    />
  );
};
LoginView.displayName = "LoginView";
export default LoginView;
