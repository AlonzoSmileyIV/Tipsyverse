import { createTheme } from "@mui/material/styles";

export const PRIMARY_COLOR = "#7B0323";

const appTheme = createTheme({
  palette: {
    primary: {
      main: PRIMARY_COLOR,
    },
  },
  typography: {
    fontFamily: "'Poppins', sans-serif",
  },
  components: {
    MuiTab: {
      styleOverrides: {
        root: {
          "&.Mui-selected": {
            color: "var(--primary-color)",
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: "var(--primary-color)",
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        contained: {
          backgroundColor: "var(--primary-color)",
          color: "#fff",
        },
        outlined: {
          borderColor: "var(--primary-color)",
          color: "var(--primary-color)",
        },
      },
    },
  },
});

export default appTheme;
