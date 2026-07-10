// @title PocketJS: Nightbloom
import Nightbloom from "./app.tsx";
import { installAugury } from "./backend.ts";
import { mount } from "@pocketjs/framework";

installAugury();
mount(() => <Nightbloom />);
