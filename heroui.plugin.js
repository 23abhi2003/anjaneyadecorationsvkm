const { heroui } = require("@heroui/theme/plugin");

module.exports = heroui({
  themes: {
    light: {
      colors: {
        background: "#F8F4E6", // cream parchment behind the logo
        foreground: "#241129", // deep aubergine hair/silhouette
        primary: {
          50: "#fbf3e0",
          100: "#f5e4b8",
          200: "#eed58f",
          300: "#e7c667",
          400: "#e0b73e",
          500: "#D9A427", // logo crown / face gold
          600: "#b4821a",
          700: "#8f6414",
          800: "#6a480e",
          900: "#452d08",
          DEFAULT: "#D9A427",
          foreground: "#241129",
        },
        secondary: {
          50: "#efe5f3",
          100: "#d7bfe1",
          200: "#bf99cf",
          300: "#a773bd",
          400: "#8f4da9",
          500: "#5B2674", // necklace bead purple
          600: "#4d2062",
          700: "#3f1a50",
          800: "#31143e",
          900: "#230e2c",
          DEFAULT: "#5B2674",
          foreground: "#F8F4E6",
        },
        success: {
          DEFAULT: "#3F6B1F", // "TENT HOUSE" leaf green
          foreground: "#F8F4E6",
        },
        danger: {
          DEFAULT: "#6E1F3A", // maroon accent
          foreground: "#F8F4E6",
        },
        warning: {
          DEFAULT: "#8B4A15", // headline ochre brown
          foreground: "#F8F4E6",
        },
        content1: {
          DEFAULT: "#FFFFFF",
          foreground: "#241129",
        },
        content2: {
          DEFAULT: "#F3ECD8",
          foreground: "#241129",
        },
        divider: "rgba(36, 17, 41, 0.12)",
      },
    },
  },
});
