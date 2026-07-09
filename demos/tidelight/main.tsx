// @title PocketJS: Tidelight
import Tidelight from "./app.tsx";
import { installTidelightWire } from "./backend.ts";
import { mount } from "@pocketjs/framework";

installTidelightWire();
mount(() => <Tidelight />);
