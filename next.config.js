/** @type {import('next').NextConfig} */
const prefix = (process.env.ENV_PREFIX || "").trim();

const nextConfig = {
  env: {
    ...(prefix && process.env[`${prefix}_NEXT_PUBLIC_APP_URL`]
      ? { NEXT_PUBLIC_APP_URL: process.env[`${prefix}_NEXT_PUBLIC_APP_URL`] }
      : {}),
  },
};

module.exports = nextConfig;
