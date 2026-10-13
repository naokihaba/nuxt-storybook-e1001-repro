import type { StorybookConfig } from "@storybook-vue/nuxt";

const config: StorybookConfig = {
  stories: ["../app/**/*.stories.ts"],
  framework: "@storybook-vue/nuxt",
};

export default config;
