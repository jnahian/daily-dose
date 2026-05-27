import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
// Serve the repo's existing public/ folder as Remotion's static asset root
Config.setPublicDir("../public");
