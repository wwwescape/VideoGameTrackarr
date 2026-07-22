# Hardware reference catalog — image filenames

Every predefined Device/Accessory shown in the app comes from a `HardwareReferenceEntry` row (the Brand/Console/Variant cascade on Add Device/Add Accessory). Curated product photos are resolved at read time by slugifying that row's `official_name` — see `backend/app/services/hardware_reference_image_service.py`

To add a new curated image: drop a 400x400 `.jpg` into `backend/static/hardware-reference/` using the exact filename below for that entry, then commit. No code or database change needed — the app checks the filesystem live.

**Naming rule** (if a new reference entry is added later and isn't in this list): lowercase the official name, replace every run of non-alphanumeric characters with a single hyphen, trim leading/trailing hyphens, append `.jpg`.

## Devices

| Brand | Official name | Image filename | Present |
|---|---|---|---|
| Microsoft | Microsoft Xbox | `microsoft-xbox.jpg` | — |
| Microsoft | Microsoft Xbox 360 | `microsoft-xbox-360.jpg` | — |
| Microsoft | Microsoft Xbox 360 E | `microsoft-xbox-360-e.jpg` | — |
| Microsoft | Microsoft Xbox 360 S | `microsoft-xbox-360-s.jpg` | — |
| Microsoft | Microsoft Xbox One | `microsoft-xbox-one.jpg` | — |
| Microsoft | Microsoft Xbox One S | `microsoft-xbox-one-s.jpg` | — |
| Microsoft | Microsoft Xbox One X | `microsoft-xbox-one-x.jpg` | — |
| Microsoft | Microsoft Xbox Series S | `microsoft-xbox-series-s.jpg` | — |
| Microsoft | Microsoft Xbox Series X | `microsoft-xbox-series-x.jpg` | — |
| Nintendo | New Nintendo 2DS XL | `new-nintendo-2ds-xl.jpg` | — |
| Nintendo | New Nintendo 3DS | `new-nintendo-3ds.jpg` | — |
| Nintendo | New Nintendo 3DS XL | `new-nintendo-3ds-xl.jpg` | — |
| Nintendo | Nintendo 2DS | `nintendo-2ds.jpg` | — |
| Nintendo | Nintendo 3DS | `nintendo-3ds.jpg` | — |
| Nintendo | Nintendo 3DS XL | `nintendo-3ds-xl.jpg` | — |
| Nintendo | Nintendo 64 | `nintendo-64.jpg` | — |
| Nintendo | Nintendo DS | `nintendo-ds.jpg` | — |
| Nintendo | Nintendo DS Lite | `nintendo-ds-lite.jpg` | — |
| Nintendo | Nintendo DSi | `nintendo-dsi.jpg` | — |
| Nintendo | Nintendo DSi XL | `nintendo-dsi-xl.jpg` | — |
| Nintendo | Nintendo Entertainment System | `nintendo-entertainment-system.jpg` | — |
| Nintendo | Nintendo Game Boy | `nintendo-game-boy.jpg` | — |
| Nintendo | Nintendo Game Boy Advance | `nintendo-game-boy-advance.jpg` | — |
| Nintendo | Nintendo Game Boy Advance SP | `nintendo-game-boy-advance-sp.jpg` | — |
| Nintendo | Nintendo Game Boy Color | `nintendo-game-boy-color.jpg` | — |
| Nintendo | Nintendo Game Boy Micro | `nintendo-game-boy-micro.jpg` | — |
| Nintendo | Nintendo GameCube | `nintendo-gamecube.jpg` | — |
| Nintendo | Nintendo Switch | `nintendo-switch.jpg` | — |
| Nintendo | Nintendo Switch 2 | `nintendo-switch-2.jpg` | — |
| Nintendo | Nintendo Switch Lite | `nintendo-switch-lite.jpg` | — |
| Nintendo | Nintendo Switch – OLED Model | `nintendo-switch-oled-model.jpg` | — |
| Nintendo | Nintendo Wii | `nintendo-wii.jpg` | — |
| Nintendo | Nintendo Wii U | `nintendo-wii-u.jpg` | — |
| Nintendo | Super Nintendo Entertainment System | `super-nintendo-entertainment-system.jpg` | — |
| Sony | Sony PSPgo | `sony-pspgo.jpg` | — |
| Sony | Sony PSone | `sony-psone.jpg` | — |
| Sony | Sony PlayStation | `sony-playstation.jpg` | ✅ |
| Sony | Sony PlayStation 2 | `sony-playstation-2.jpg` | ✅ |
| Sony | Sony PlayStation 2 Slim | `sony-playstation-2-slim.jpg` | ✅ |
| Sony | Sony PlayStation 3 | `sony-playstation-3.jpg` | ✅ |
| Sony | Sony PlayStation 3 Slim | `sony-playstation-3-slim.jpg` | ✅ |
| Sony | Sony PlayStation 3 Super Slim | `sony-playstation-3-super-slim.jpg` | ✅ |
| Sony | Sony PlayStation 4 | `sony-playstation-4.jpg` | ✅ |
| Sony | Sony PlayStation 4 Pro | `sony-playstation-4-pro.jpg` | ✅ |
| Sony | Sony PlayStation 4 Slim | `sony-playstation-4-slim.jpg` | ✅ |
| Sony | Sony PlayStation 5 Digital Edition | `sony-playstation-5-digital-edition.jpg` | ✅ |
| Sony | Sony PlayStation 5 Disc Edition | `sony-playstation-5-disc-edition.jpg` | ✅ |
| Sony | Sony PlayStation 5 Pro | `sony-playstation-5-pro.jpg` | ✅ |
| Sony | Sony PlayStation 5 Slim Digital Edition | `sony-playstation-5-slim-digital-edition.jpg` | ✅ |
| Sony | Sony PlayStation 5 Slim Disc Edition | `sony-playstation-5-slim-disc-edition.jpg` | ✅ |
| Sony | Sony PlayStation Portable | `sony-playstation-portable.jpg` | — |
| Sony | Sony PlayStation Portal | `sony-playstation-portal.jpg` | — |
| Sony | Sony PlayStation TV | `sony-playstation-tv.jpg` | — |
| Sony | Sony PlayStation Vita | `sony-playstation-vita.jpg` | — |
| Sony | Sony PocketStation | `sony-pocketstation.jpg` | — |

## Accessories

| Brand | Official name | Image filename | Present |
|---|---|---|---|
| Microsoft | Microsoft Kinect Sensor | `microsoft-kinect-sensor.jpg` | — |
| Microsoft | Microsoft Kinect for Xbox One | `microsoft-kinect-for-xbox-one.jpg` | — |
| Microsoft | Microsoft Xbox 360 Chatpad | `microsoft-xbox-360-chatpad.jpg` | — |
| Microsoft | Microsoft Xbox 360 Media Remote | `microsoft-xbox-360-media-remote.jpg` | — |
| Microsoft | Microsoft Xbox 360 Play & Charge Kit | `microsoft-xbox-360-play-charge-kit.jpg` | — |
| Microsoft | Microsoft Xbox 360 Wireless Controller | `microsoft-xbox-360-wireless-controller.jpg` | — |
| Microsoft | Microsoft Xbox Adaptive Controller | `microsoft-xbox-adaptive-controller.jpg` | — |
| Microsoft | Microsoft Xbox Controller S | `microsoft-xbox-controller-s.jpg` | — |
| Microsoft | Microsoft Xbox DVD Playback Kit | `microsoft-xbox-dvd-playback-kit.jpg` | — |
| Microsoft | Microsoft Xbox DVD Remote | `microsoft-xbox-dvd-remote.jpg` | — |
| Microsoft | Microsoft Xbox Duke Controller | `microsoft-xbox-duke-controller.jpg` | — |
| Microsoft | Microsoft Xbox Elite Wireless Controller Series 2 | `microsoft-xbox-elite-wireless-controller-series-2.jpg` | — |
| Microsoft | Microsoft Xbox Live Communicator | `microsoft-xbox-live-communicator.jpg` | — |
| Microsoft | Microsoft Xbox Media Remote | `microsoft-xbox-media-remote.jpg` | — |
| Microsoft | Microsoft Xbox Memory Unit | `microsoft-xbox-memory-unit.jpg` | — |
| Microsoft | Microsoft Xbox Stereo Headset | `microsoft-xbox-stereo-headset.jpg` | — |
| Microsoft | Microsoft Xbox Wireless Controller | `microsoft-xbox-wireless-controller.jpg` | — |
| Microsoft | Microsoft Xbox Wireless Headset | `microsoft-xbox-wireless-headset.jpg` | — |
| Microsoft | Xbox Storage Expansion Card | `xbox-storage-expansion-card.jpg` | — |
| Nintendo | Nintendo Classic Controller | `nintendo-classic-controller.jpg` | — |
| Nintendo | Nintendo DK Bongos | `nintendo-dk-bongos.jpg` | — |
| Nintendo | Nintendo Game Boy Camera | `nintendo-game-boy-camera.jpg` | — |
| Nintendo | Nintendo Game Boy Player | `nintendo-game-boy-player.jpg` | — |
| Nintendo | Nintendo Game Boy Printer | `nintendo-game-boy-printer.jpg` | — |
| Nintendo | Nintendo Joy-Con (Left) | `nintendo-joy-con-left.jpg` | — |
| Nintendo | Nintendo Joy-Con (Right) | `nintendo-joy-con-right.jpg` | — |
| Nintendo | Nintendo Joy-Con 2 (Left) | `nintendo-joy-con-2-left.jpg` | — |
| Nintendo | Nintendo Joy-Con 2 (Right) | `nintendo-joy-con-2-right.jpg` | — |
| Nintendo | Nintendo Joy-Con 2 Charging Grip | `nintendo-joy-con-2-charging-grip.jpg` | — |
| Nintendo | Nintendo Joy-Con Charging Grip | `nintendo-joy-con-charging-grip.jpg` | — |
| Nintendo | Nintendo Leg Strap | `nintendo-leg-strap.jpg` | — |
| Nintendo | Nintendo NES Zapper | `nintendo-nes-zapper.jpg` | — |
| Nintendo | Nintendo Nunchuk | `nintendo-nunchuk.jpg` | — |
| Nintendo | Nintendo Poké Ball Plus | `nintendo-pok-ball-plus.jpg` | — |
| Nintendo | Nintendo R.O.B. | `nintendo-r-o-b.jpg` | — |
| Nintendo | Nintendo Ring-Con | `nintendo-ring-con.jpg` | — |
| Nintendo | Nintendo Rumble Pak | `nintendo-rumble-pak.jpg` | — |
| Nintendo | Nintendo Super Scope | `nintendo-super-scope.jpg` | — |
| Nintendo | Nintendo Switch 2 Camera | `nintendo-switch-2-camera.jpg` | — |
| Nintendo | Nintendo Switch 2 Pro Controller | `nintendo-switch-2-pro-controller.jpg` | — |
| Nintendo | Nintendo Switch Pro Controller | `nintendo-switch-pro-controller.jpg` | — |
| Nintendo | Nintendo Transfer Pak | `nintendo-transfer-pak.jpg` | — |
| Nintendo | Nintendo WaveBird Wireless Controller | `nintendo-wavebird-wireless-controller.jpg` | — |
| Nintendo | Nintendo Wii Balance Board | `nintendo-wii-balance-board.jpg` | — |
| Nintendo | Nintendo Wii MotionPlus | `nintendo-wii-motionplus.jpg` | — |
| Nintendo | Nintendo Wii Remote | `nintendo-wii-remote.jpg` | — |
| Nintendo | Nintendo Wii U GamePad | `nintendo-wii-u-gamepad.jpg` | — |
| Nintendo | Nintendo e-Reader | `nintendo-e-reader.jpg` | — |
| Sony | Sony Access Controller | `sony-access-controller.jpg` | — |
| Sony | Sony Blu-ray Disc Remote (PlayStation 3) | `sony-blu-ray-disc-remote-playstation-3.jpg` | — |
| Sony | Sony Buzz Controller | `sony-buzz-controller.jpg` | — |
| Sony | Sony DualSense Charging Station | `sony-dualsense-charging-station.jpg` | — |
| Sony | Sony DualSense Edge Controller | `sony-dualsense-edge-controller.jpg` | — |
| Sony | Sony DualSense Wireless Controller | `sony-dualsense-wireless-controller.jpg` | — |
| Sony | Sony DualShock 2 Controller | `sony-dualshock-2-controller.jpg` | — |
| Sony | Sony DualShock 4 Wireless Controller | `sony-dualshock-4-wireless-controller.jpg` | — |
| Sony | Sony DualShock Controller | `sony-dualshock-controller.jpg` | — |
| Sony | Sony EyeToy Camera | `sony-eyetoy-camera.jpg` | — |
| Sony | Sony HD Camera | `sony-hd-camera.jpg` | — |
| Sony | Sony PS Eye Camera | `sony-ps-eye-camera.jpg` | — |
| Sony | Sony PS Move Motion Controller | `sony-ps-move-motion-controller.jpg` | — |
| Sony | Sony PS Move Navigation Controller | `sony-ps-move-navigation-controller.jpg` | — |
| Sony | Sony PS Move Sharp Shooter | `sony-ps-move-sharp-shooter.jpg` | — |
| Sony | Sony PS Move Shooting Attachment | `sony-ps-move-shooting-attachment.jpg` | — |
| Sony | Sony PS VR Aim Controller | `sony-ps-vr-aim-controller.jpg` | — |
| Sony | Sony PS VR Processor Unit | `sony-ps-vr-processor-unit.jpg` | — |
| Sony | Sony PS VR2 Sense Controller (Left) | `sony-ps-vr2-sense-controller-left.jpg` | — |
| Sony | Sony PS VR2 Sense Controller (Right) | `sony-ps-vr2-sense-controller-right.jpg` | — |
| Sony | Sony PS VR2 Sense Controller Charging Station | `sony-ps-vr2-sense-controller-charging-station.jpg` | — |
| Sony | Sony PSP Camera | `sony-psp-camera.jpg` | — |
| Sony | Sony PSP GPS Receiver | `sony-psp-gps-receiver.jpg` | — |
| Sony | Sony PSP Microphone | `sony-psp-microphone.jpg` | — |
| Sony | Sony PSP UMD | `sony-psp-umd.jpg` | — |
| Sony | Sony PSone LCD Monitor | `sony-psone-lcd-monitor.jpg` | — |
| Sony | Sony PULSE 3D Wireless Headset | `sony-pulse-3d-wireless-headset.jpg` | — |
| Sony | Sony PULSE Elite Wireless Headset | `sony-pulse-elite-wireless-headset.jpg` | — |
| Sony | Sony PULSE Explore Wireless Earbuds | `sony-pulse-explore-wireless-earbuds.jpg` | — |
| Sony | Sony PlayStation 2 Game Disc | `sony-playstation-2-game-disc.jpg` | — |
| Sony | Sony PlayStation 2 Memory Card | `sony-playstation-2-memory-card.jpg` | — |
| Sony | Sony PlayStation 2 Multitap | `sony-playstation-2-multitap.jpg` | — |
| Sony | Sony PlayStation 2 Network Adaptor | `sony-playstation-2-network-adaptor.jpg` | — |
| Sony | Sony PlayStation 3 Game Disc | `sony-playstation-3-game-disc.jpg` | — |
| Sony | Sony PlayStation 5 Console Covers | `sony-playstation-5-console-covers.jpg` | — |
| Sony | Sony PlayStation 5 Pro Console Covers | `sony-playstation-5-pro-console-covers.jpg` | — |
| Sony | Sony PlayStation 5 Slim Console Covers | `sony-playstation-5-slim-console-covers.jpg` | — |
| Sony | Sony PlayStation Camera | `sony-playstation-camera.jpg` | — |
| Sony | Sony PlayStation Controller | `sony-playstation-controller.jpg` | — |
| Sony | Sony PlayStation Disc Drive | `sony-playstation-disc-drive.jpg` | — |
| Sony | Sony PlayStation Game Disc | `sony-playstation-game-disc.jpg` | — |
| Sony | Sony PlayStation Link USB Adapter | `sony-playstation-link-usb-adapter.jpg` | — |
| Sony | Sony PlayStation Media Remote (PlayStation 2) | `sony-playstation-media-remote-playstation-2.jpg` | — |
| Sony | Sony PlayStation Media Remote (PlayStation 4) | `sony-playstation-media-remote-playstation-4.jpg` | — |
| Sony | Sony PlayStation Media Remote (PlayStation 5) | `sony-playstation-media-remote-playstation-5.jpg` | — |
| Sony | Sony PlayStation Memory Card | `sony-playstation-memory-card.jpg` | — |
| Sony | Sony PlayStation Mouse | `sony-playstation-mouse.jpg` | — |
| Sony | Sony PlayStation Multitap | `sony-playstation-multitap.jpg` | — |
| Sony | Sony PlayStation VR Camera Adapter | `sony-playstation-vr-camera-adapter.jpg` | — |
| Sony | Sony PlayStation VR Headset | `sony-playstation-vr-headset.jpg` | — |
| Sony | Sony PlayStation VR2 Headset | `sony-playstation-vr2-headset.jpg` | — |
| Sony | Sony PlayStation Vita Game Card | `sony-playstation-vita-game-card.jpg` | — |
| Sony | Sony SIXAXIS Controller | `sony-sixaxis-controller.jpg` | — |
| Sony | Sony SingStar Microphone | `sony-singstar-microphone.jpg` | — |
