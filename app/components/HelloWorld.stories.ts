import type { Meta, StoryObj } from "@storybook-vue/nuxt";

import HelloWorld from "./HelloWorld.vue";

const meta = {
  component: HelloWorld,
} satisfies Meta<typeof HelloWorld>;

export default meta;

export const Default: StoryObj<typeof meta> = {};
