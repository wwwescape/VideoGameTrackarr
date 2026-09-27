# Hardware reference catalog — image filenames

Every predefined Device/Accessory shown in the app comes from a `HardwareReferenceEntry` row (the Brand/Console/Variant cascade on Add Device/Add Accessory), seeded from `docs/data/hardware/*.csv`. Curated product photos are resolved at read time by slugifying that row's `official_name` — see `backend/app/services/hardware_reference_image_service.py`

To add a new curated image: drop a 400x400 `.jpg` into `backend/static/hardware-reference/` using the exact filename below for that entry, then commit. No code or database change needed — the app checks the filesystem live.

**Naming rule** (if a new reference entry is added later and isn't in this list): lowercase the official name, replace every run of non-alphanumeric characters with a single hyphen, trim leading/trailing hyphens, append `.jpg`.

**Summary: 193 rows. Devices: 57/74 images present. Accessories: 119 missing an image.**

## Devices

| Brand | Official name | Short name | DB present | Image filename | Image present |
|---|---|---|---|---|---|
| Microsoft | Microsoft Xbox | Xbox | ✅ | `microsoft-xbox.jpg` | ✅ |
| Microsoft | Microsoft Xbox 360 | X360 | ✅ | `microsoft-xbox-360.jpg` | ✅ |
| Microsoft | Microsoft Xbox 360 E | X360 | ✅ | `microsoft-xbox-360-e.jpg` | ✅ |
| Microsoft | Microsoft Xbox 360 S | X360 | ✅ | `microsoft-xbox-360-s.jpg` | ✅ |
| Microsoft | Microsoft Xbox One | XB1 | ✅ | `microsoft-xbox-one.jpg` | ✅ |
| Microsoft | Microsoft Xbox One S | XB1 | ✅ | `microsoft-xbox-one-s.jpg` | ✅ |
| Microsoft | Microsoft Xbox One X | XB1 | ✅ | `microsoft-xbox-one-x.jpg` | ✅ |
| Microsoft | Microsoft Xbox Series S | Series X|S | ✅ | `microsoft-xbox-series-s.jpg` | ✅ |
| Microsoft | Microsoft Xbox Series X | Series X|S | ✅ | `microsoft-xbox-series-x.jpg` | ✅ |
| Nintendo | Family Computer | Famicom | ✅ | `family-computer.jpg` | ✅ |
| Nintendo | New Nintendo 2DS XL | 3DS | ✅ | `new-nintendo-2ds-xl.jpg` | ✅ |
| Nintendo | New Nintendo 3DS | 3DS | ✅ | `new-nintendo-3ds.jpg` | ✅ |
| Nintendo | New Nintendo 3DS XL | 3DS | ✅ | `new-nintendo-3ds-xl.jpg` | ✅ |
| Nintendo | Nintendo 2DS | 3DS | ✅ | `nintendo-2ds.jpg` | ✅ |
| Nintendo | Nintendo 3DS | 3DS | ✅ | `nintendo-3ds.jpg` | ✅ |
| Nintendo | Nintendo 3DS XL | 3DS | ✅ | `nintendo-3ds-xl.jpg` | ✅ |
| Nintendo | Nintendo 64 | N64 | ✅ | `nintendo-64.jpg` | ✅ |
| Nintendo | Nintendo DS | NDS | ✅ | `nintendo-ds.jpg` | ✅ |
| Nintendo | Nintendo DS Lite | NDS | ✅ | `nintendo-ds-lite.jpg` | ✅ |
| Nintendo | Nintendo DSi | NDS | ✅ | `nintendo-dsi.jpg` | ✅ |
| Nintendo | Nintendo DSi XL | NDS | ✅ | `nintendo-dsi-xl.jpg` | ✅ |
| Nintendo | Nintendo Entertainment System | NES | ✅ | `nintendo-entertainment-system.jpg` | ✅ |
| Nintendo | Nintendo Game Boy | GB | ✅ | `nintendo-game-boy.jpg` | ✅ |
| Nintendo | Nintendo Game Boy Advance | GBA | ✅ | `nintendo-game-boy-advance.jpg` | ✅ |
| Nintendo | Nintendo Game Boy Advance SP | GBA | ✅ | `nintendo-game-boy-advance-sp.jpg` | ✅ |
| Nintendo | Nintendo Game Boy Color | GBC | ✅ | `nintendo-game-boy-color.jpg` | ✅ |
| Nintendo | Nintendo Game Boy Micro | GBA | ✅ | `nintendo-game-boy-micro.jpg` | ✅ |
| Nintendo | Nintendo GameCube | GC | ✅ | `nintendo-gamecube.jpg` | ✅ |
| Nintendo | Nintendo Switch | Switch | ✅ | `nintendo-switch.jpg` | ✅ |
| Nintendo | Nintendo Switch 2 | Switch 2 | ✅ | `nintendo-switch-2.jpg` | ✅ |
| Nintendo | Nintendo Switch Lite | Switch | ✅ | `nintendo-switch-lite.jpg` | ✅ |
| Nintendo | Nintendo Switch – OLED Model | Switch | ✅ | `nintendo-switch-oled-model.jpg` | ✅ |
| Nintendo | Nintendo Wii | Wii | ✅ | `nintendo-wii.jpg` | ✅ |
| Nintendo | Nintendo Wii U | Wii U | ✅ | `nintendo-wii-u.jpg` | ✅ |
| Nintendo | Super Nintendo Entertainment System | SNES | ✅ | `super-nintendo-entertainment-system.jpg` | ✅ |
| Sega | Sega 32X | 32X | ✅ | `sega-32x.jpg` | — |
| Sega | Sega CD | SCD | ✅ | `sega-cd.jpg` | — |
| Sega | Sega CD 2 | SCD | ✅ | `sega-cd-2.jpg` | — |
| Sega | Sega CDX | Genesis | ✅ | `sega-cdx.jpg` | — |
| Sega | Sega Dreamcast | DC | ✅ | `sega-dreamcast.jpg` | — |
| Sega | Sega Game Gear | GG | ✅ | `sega-game-gear.jpg` | — |
| Sega | Sega Genesis | Genesis | ✅ | `sega-genesis.jpg` | — |
| Sega | Sega Genesis 2 | Genesis | ✅ | `sega-genesis-2.jpg` | — |
| Sega | Sega Genesis 3 | Genesis | ✅ | `sega-genesis-3.jpg` | — |
| Sega | Sega Master System | SMS | ✅ | `sega-master-system.jpg` | — |
| Sega | Sega Master System II | SMS | ✅ | `sega-master-system-ii.jpg` | — |
| Sega | Sega Mega-CD | MCD | ✅ | `sega-mega-cd.jpg` | — |
| Sega | Sega Mega-CD 2 | MCD | ✅ | `sega-mega-cd-2.jpg` | — |
| Sega | Sega Mega Drive | MD | ✅ | `sega-mega-drive.jpg` | — |
| Sega | Sega Mega Drive II | MD | ✅ | `sega-mega-drive-ii.jpg` | — |
| Sega | Sega Nomad | Genesis | ✅ | `sega-nomad.jpg` | — |
| Sega | Sega Saturn | SAT | ✅ | `sega-saturn.jpg` | — |
| Sony | Sony PSPgo | PSP | ✅ | `sony-pspgo.jpg` | ✅ |
| Sony | Sony PSX | PS2 | ✅ | `sony-psx.jpg` | ✅ |
| Sony | Sony PSone | PS1 | ✅ | `sony-psone.jpg` | ✅ |
| Sony | Sony PlayStation | PS1 | ✅ | `sony-playstation.jpg` | ✅ |
| Sony | Sony PlayStation 2 | PS2 | ✅ | `sony-playstation-2.jpg` | ✅ |
| Sony | Sony PlayStation 2 Slim | PS2 | ✅ | `sony-playstation-2-slim.jpg` | ✅ |
| Sony | Sony PlayStation 3 | PS3 | ✅ | `sony-playstation-3.jpg` | ✅ |
| Sony | Sony PlayStation 3 Slim | PS3 | ✅ | `sony-playstation-3-slim.jpg` | ✅ |
| Sony | Sony PlayStation 3 Super Slim | PS3 | ✅ | `sony-playstation-3-super-slim.jpg` | ✅ |
| Sony | Sony PlayStation 4 | PS4 | ✅ | `sony-playstation-4.jpg` | ✅ |
| Sony | Sony PlayStation 4 Pro | PS4 | ✅ | `sony-playstation-4-pro.jpg` | ✅ |
| Sony | Sony PlayStation 4 Slim | PS4 | ✅ | `sony-playstation-4-slim.jpg` | ✅ |
| Sony | Sony PlayStation 5 Digital Edition | PS5 | ✅ | `sony-playstation-5-digital-edition.jpg` | ✅ |
| Sony | Sony PlayStation 5 Disc Edition | PS5 | ✅ | `sony-playstation-5-disc-edition.jpg` | ✅ |
| Sony | Sony PlayStation 5 Pro | PS5 | ✅ | `sony-playstation-5-pro.jpg` | ✅ |
| Sony | Sony PlayStation 5 Slim Digital Edition | PS5 | ✅ | `sony-playstation-5-slim-digital-edition.jpg` | ✅ |
| Sony | Sony PlayStation 5 Slim Disc Edition | PS5 | ✅ | `sony-playstation-5-slim-disc-edition.jpg` | ✅ |
| Sony | Sony PlayStation Portable | PSP | ✅ | `sony-playstation-portable.jpg` | ✅ |
| Sony | Sony PlayStation Portal | PS5 | ✅ | `sony-playstation-portal.jpg` | ✅ |
| Sony | Sony PlayStation TV | PS Vita | ✅ | `sony-playstation-tv.jpg` | ✅ |
| Sony | Sony PlayStation Vita | PS Vita | ✅ | `sony-playstation-vita.jpg` | ✅ |
| Sony | Sony PocketStation | PS1 | ✅ | `sony-pocketstation.jpg` | ✅ |

## Accessories

| Brand | Official name | Short name | DB present | Image filename | Image present |
|---|---|---|---|---|---|
| Microsoft | Microsoft Kinect Sensor | X360 | ✅ | `microsoft-kinect-sensor.jpg` | — |
| Microsoft | Microsoft Kinect for Xbox One | XB1 | ✅ | `microsoft-kinect-for-xbox-one.jpg` | — |
| Microsoft | Microsoft Xbox 360 Chatpad | X360 | ✅ | `microsoft-xbox-360-chatpad.jpg` | — |
| Microsoft | Microsoft Xbox 360 Media Remote | X360 | ✅ | `microsoft-xbox-360-media-remote.jpg` | — |
| Microsoft | Microsoft Xbox 360 Play & Charge Kit | X360 | ✅ | `microsoft-xbox-360-play-charge-kit.jpg` | — |
| Microsoft | Microsoft Xbox 360 Wireless Controller | X360 | ✅ | `microsoft-xbox-360-wireless-controller.jpg` | — |
| Microsoft | Microsoft Xbox Adaptive Controller | Series X|S | ✅ | `microsoft-xbox-adaptive-controller.jpg` | — |
| Microsoft | Microsoft Xbox Controller S | Xbox | ✅ | `microsoft-xbox-controller-s.jpg` | — |
| Microsoft | Microsoft Xbox DVD Playback Kit | Xbox | ✅ | `microsoft-xbox-dvd-playback-kit.jpg` | — |
| Microsoft | Microsoft Xbox DVD Remote | Xbox | ✅ | `microsoft-xbox-dvd-remote.jpg` | — |
| Microsoft | Microsoft Xbox Duke Controller | Xbox | ✅ | `microsoft-xbox-duke-controller.jpg` | — |
| Microsoft | Microsoft Xbox Elite Wireless Controller Series 2 | Series X|S | ✅ | `microsoft-xbox-elite-wireless-controller-series-2.jpg` | — |
| Microsoft | Microsoft Xbox Live Communicator | Xbox | ✅ | `microsoft-xbox-live-communicator.jpg` | — |
| Microsoft | Microsoft Xbox Media Remote | XB1 | ✅ | `microsoft-xbox-media-remote.jpg` | — |
| Microsoft | Microsoft Xbox Memory Unit | Xbox | ✅ | `microsoft-xbox-memory-unit.jpg` | — |
| Microsoft | Microsoft Xbox Stereo Headset | XB1 | ✅ | `microsoft-xbox-stereo-headset.jpg` | — |
| Microsoft | Microsoft Xbox Wireless Controller | XB1 | ✅ | `microsoft-xbox-wireless-controller.jpg` | — |
| Microsoft | Microsoft Xbox Wireless Headset | Series X|S | ✅ | `microsoft-xbox-wireless-headset.jpg` | — |
| Microsoft | Xbox Storage Expansion Card | Series X|S | ✅ | `xbox-storage-expansion-card.jpg` | — |
| Nintendo | Nintendo Classic Controller | Wii | ✅ | `nintendo-classic-controller.jpg` | — |
| Nintendo | Nintendo DK Bongos | GC | ✅ | `nintendo-dk-bongos.jpg` | — |
| Nintendo | Nintendo Game Boy Camera | GB | ✅ | `nintendo-game-boy-camera.jpg` | — |
| Nintendo | Nintendo Game Boy Player | GC | ✅ | `nintendo-game-boy-player.jpg` | — |
| Nintendo | Nintendo Game Boy Printer | GB | ✅ | `nintendo-game-boy-printer.jpg` | — |
| Nintendo | Nintendo Joy-Con (Left) | Switch | ✅ | `nintendo-joy-con-left.jpg` | — |
| Nintendo | Nintendo Joy-Con (Right) | Switch | ✅ | `nintendo-joy-con-right.jpg` | — |
| Nintendo | Nintendo Joy-Con 2 (Left) | Switch 2 | ✅ | `nintendo-joy-con-2-left.jpg` | — |
| Nintendo | Nintendo Joy-Con 2 (Right) | Switch 2 | ✅ | `nintendo-joy-con-2-right.jpg` | — |
| Nintendo | Nintendo Joy-Con 2 Charging Grip | Switch 2 | ✅ | `nintendo-joy-con-2-charging-grip.jpg` | — |
| Nintendo | Nintendo Joy-Con Charging Grip | Switch | ✅ | `nintendo-joy-con-charging-grip.jpg` | — |
| Nintendo | Nintendo Leg Strap | Switch | ✅ | `nintendo-leg-strap.jpg` | — |
| Nintendo | Nintendo NES Zapper | NES | ✅ | `nintendo-nes-zapper.jpg` | — |
| Nintendo | Nintendo Nunchuk | Wii | ✅ | `nintendo-nunchuk.jpg` | — |
| Nintendo | Nintendo Poké Ball Plus | Switch | ✅ | `nintendo-pok-ball-plus.jpg` | — |
| Nintendo | Nintendo R.O.B. | NES | ✅ | `nintendo-r-o-b.jpg` | — |
| Nintendo | Nintendo Ring-Con | Switch | ✅ | `nintendo-ring-con.jpg` | — |
| Nintendo | Nintendo Rumble Pak | N64 | ✅ | `nintendo-rumble-pak.jpg` | — |
| Nintendo | Nintendo Super Scope | SNES | ✅ | `nintendo-super-scope.jpg` | — |
| Nintendo | Nintendo Switch 2 Camera | Switch 2 | ✅ | `nintendo-switch-2-camera.jpg` | — |
| Nintendo | Nintendo Switch 2 Pro Controller | Switch 2 | ✅ | `nintendo-switch-2-pro-controller.jpg` | — |
| Nintendo | Nintendo Switch Pro Controller | Switch | ✅ | `nintendo-switch-pro-controller.jpg` | — |
| Nintendo | Nintendo Transfer Pak | N64 | ✅ | `nintendo-transfer-pak.jpg` | — |
| Nintendo | Nintendo WaveBird Wireless Controller | GC | ✅ | `nintendo-wavebird-wireless-controller.jpg` | — |
| Nintendo | Nintendo Wii Balance Board | Wii | ✅ | `nintendo-wii-balance-board.jpg` | — |
| Nintendo | Nintendo Wii MotionPlus | Wii | ✅ | `nintendo-wii-motionplus.jpg` | — |
| Nintendo | Nintendo Wii Remote | Wii | ✅ | `nintendo-wii-remote.jpg` | — |
| Nintendo | Nintendo Wii U GamePad | Wii U | ✅ | `nintendo-wii-u-gamepad.jpg` | — |
| Nintendo | Nintendo e-Reader | GBA | ✅ | `nintendo-e-reader.jpg` | — |
| Sega | Sega 6-Button Arcade Pad | MD | ✅ | `sega-6-button-arcade-pad.jpg` | — |
| Sega | Sega Activator | MD | ✅ | `sega-activator.jpg` | — |
| Sega | Sega Dreamcast Arcade Stick | DC | ✅ | `sega-dreamcast-arcade-stick.jpg` | — |
| Sega | Sega Dreamcast Controller | DC | ✅ | `sega-dreamcast-controller.jpg` | — |
| Sega | Sega Dreamcast Jump Pack | DC | ✅ | `sega-dreamcast-jump-pack.jpg` | — |
| Sega | Sega Dreamcast Keyboard | DC | ✅ | `sega-dreamcast-keyboard.jpg` | — |
| Sega | Sega Dreamcast Mouse | DC | ✅ | `sega-dreamcast-mouse.jpg` | — |
| Sega | Sega Dreamcast VMU | DC | ✅ | `sega-dreamcast-vmu.jpg` | — |
| Sega | Sega Game Gear TV Tuner | GG | ✅ | `sega-game-gear-tv-tuner.jpg` | — |
| Sega | Sega Genesis/Mega Drive Control Pad | MD | ✅ | `sega-genesis-mega-drive-control-pad.jpg` | — |
| Sega | Sega Light Phaser | SMS | ✅ | `sega-light-phaser.jpg` | — |
| Sega | Sega Master System Control Pad | SMS | ✅ | `sega-master-system-control-pad.jpg` | — |
| Sega | Sega Menacer | MD | ✅ | `sega-menacer.jpg` | — |
| Sega | Sega Power Base Converter | MD | ✅ | `sega-power-base-converter.jpg` | — |
| Sega | Sega Saturn 3D Control Pad | SAT | ✅ | `sega-saturn-3d-control-pad.jpg` | — |
| Sega | Sega Saturn Control Pad | SAT | ✅ | `sega-saturn-control-pad.jpg` | — |
| Sega | Sega Saturn Memory Cartridge | SAT | ✅ | `sega-saturn-memory-cartridge.jpg` | — |
| Sega | Sega Saturn Mouse | SAT | ✅ | `sega-saturn-mouse.jpg` | — |
| Sega | Sega Saturn NetLink | SAT | ✅ | `sega-saturn-netlink.jpg` | — |
| Sega | Sega SegaScope 3-D Glasses | SMS | ✅ | `sega-segascope-3-d-glasses.jpg` | — |
| Sony | Sony Access Controller | PS5 | ✅ | `sony-access-controller.jpg` | — |
| Sony | Sony Blu-ray Disc Remote (PlayStation 3) | PS3 | ✅ | `sony-blu-ray-disc-remote-playstation-3.jpg` | — |
| Sony | Sony Buzz Controller | PS2 | ✅ | `sony-buzz-controller.jpg` | — |
| Sony | Sony DualSense Charging Station | PS5 | ✅ | `sony-dualsense-charging-station.jpg` | — |
| Sony | Sony DualSense Edge Controller | PS5 | ✅ | `sony-dualsense-edge-controller.jpg` | — |
| Sony | Sony DualSense Wireless Controller | PS5 | ✅ | `sony-dualsense-wireless-controller.jpg` | — |
| Sony | Sony DualShock 2 Controller | PS2 | ✅ | `sony-dualshock-2-controller.jpg` | — |
| Sony | Sony DualShock 4 Wireless Controller | PS4 | ✅ | `sony-dualshock-4-wireless-controller.jpg` | — |
| Sony | Sony DualShock Controller | PS1 | ✅ | `sony-dualshock-controller.jpg` | — |
| Sony | Sony EyeToy Camera | PS2 | ✅ | `sony-eyetoy-camera.jpg` | — |
| Sony | Sony HD Camera | PS5 | ✅ | `sony-hd-camera.jpg` | — |
| Sony | Sony PSone LCD Monitor | PS1 | ✅ | `sony-psone-lcd-monitor.jpg` | — |
| Sony | Sony PULSE 3D Wireless Headset | PS5 | ✅ | `sony-pulse-3d-wireless-headset.jpg` | — |
| Sony | Sony PULSE Elite Wireless Headset | PS5 | ✅ | `sony-pulse-elite-wireless-headset.jpg` | — |
| Sony | Sony PULSE Explore Wireless Earbuds | PS5 | ✅ | `sony-pulse-explore-wireless-earbuds.jpg` | — |
| Sony | Sony PlayStation 2 Game Disc | PS2 | ✅ | `sony-playstation-2-game-disc.jpg` | — |
| Sony | Sony PlayStation 2 Memory Card | PS2 | ✅ | `sony-playstation-2-memory-card.jpg` | — |
| Sony | Sony PlayStation 2 Multitap | PS2 | ✅ | `sony-playstation-2-multitap.jpg` | — |
| Sony | Sony PlayStation 2 Network Adaptor | PS2 | ✅ | `sony-playstation-2-network-adaptor.jpg` | — |
| Sony | Sony PlayStation 3 Game Disc | PS3 | ✅ | `sony-playstation-3-game-disc.jpg` | — |
| Sony | Sony PlayStation Camera | PS4 | ✅ | `sony-playstation-camera.jpg` | — |
| Sony | Sony PlayStation Controller | PS1 | ✅ | `sony-playstation-controller.jpg` | — |
| Sony | Sony PlayStation Disc Drive | PS5 | ✅ | `sony-playstation-disc-drive.jpg` | — |
| Sony | Sony PlayStation Eye Camera | PS3 | ✅ | `sony-playstation-eye-camera.jpg` | — |
| Sony | Sony PlayStation Game Disc | PS1 | ✅ | `sony-playstation-game-disc.jpg` | — |
| Sony | Sony PlayStation Link USB Adapter | PS5 | ✅ | `sony-playstation-link-usb-adapter.jpg` | — |
| Sony | Sony PlayStation Media Remote (PlayStation 2) | PS2 | ✅ | `sony-playstation-media-remote-playstation-2.jpg` | — |
| Sony | Sony PlayStation Media Remote (PlayStation 4) | PS4 | ✅ | `sony-playstation-media-remote-playstation-4.jpg` | — |
| Sony | Sony PlayStation Media Remote (PlayStation 5) | PS5 | ✅ | `sony-playstation-media-remote-playstation-5.jpg` | — |
| Sony | Sony PlayStation Memory Card | PS1 | ✅ | `sony-playstation-memory-card.jpg` | — |
| Sony | Sony PlayStation Mouse | PS1 | ✅ | `sony-playstation-mouse.jpg` | — |
| Sony | Sony PlayStation Move Motion Controller | PS3 | ✅ | `sony-playstation-move-motion-controller.jpg` | — |
| Sony | Sony PlayStation Move Navigation Controller | PS3 | ✅ | `sony-playstation-move-navigation-controller.jpg` | — |
| Sony | Sony PlayStation Move Sharp Shooter | PS3 | ✅ | `sony-playstation-move-sharp-shooter.jpg` | — |
| Sony | Sony PlayStation Move Shooting Attachment | PS3 | ✅ | `sony-playstation-move-shooting-attachment.jpg` | — |
| Sony | Sony PlayStation Multitap | PS1 | ✅ | `sony-playstation-multitap.jpg` | — |
| Sony | Sony PlayStation Portable Camera | PSP | ✅ | `sony-playstation-portable-camera.jpg` | — |
| Sony | Sony PlayStation Portable GPS Receiver | PSP | ✅ | `sony-playstation-portable-gps-receiver.jpg` | — |
| Sony | Sony PlayStation Portable Microphone | PSP | ✅ | `sony-playstation-portable-microphone.jpg` | — |
| Sony | Sony PlayStation Portable UMD | PSP | ✅ | `sony-playstation-portable-umd.jpg` | — |
| Sony | Sony PlayStation VR Aim Controller | PS4 | ✅ | `sony-playstation-vr-aim-controller.jpg` | — |
| Sony | Sony PlayStation VR Camera Adapter | PS1 | ✅ | `sony-playstation-vr-camera-adapter.jpg` | — |
| Sony | Sony PlayStation VR Headset | PS1 | ✅ | `sony-playstation-vr-headset.jpg` | — |
| Sony | Sony PlayStation VR Processor Unit | PS4 | ✅ | `sony-playstation-vr-processor-unit.jpg` | — |
| Sony | Sony PlayStation VR2 Headset | PS5 | ✅ | `sony-playstation-vr2-headset.jpg` | — |
| Sony | Sony PlayStation VR2 Sense Controller (Left) | PS5 | ✅ | `sony-playstation-vr2-sense-controller-left.jpg` | — |
| Sony | Sony PlayStation VR2 Sense Controller (Right) | PS5 | ✅ | `sony-playstation-vr2-sense-controller-right.jpg` | — |
| Sony | Sony PlayStation VR2 Sense Controller Charging Station | PS5 | ✅ | `sony-playstation-vr2-sense-controller-charging-station.jpg` | — |
| Sony | Sony PlayStation Vita Game Card | PS Vita | ✅ | `sony-playstation-vita-game-card.jpg` | — |
| Sony | Sony SIXAXIS Controller | PS3 | ✅ | `sony-sixaxis-controller.jpg` | — |
| Sony | Sony SingStar Microphone | PS2 | ✅ | `sony-singstar-microphone.jpg` | — |
