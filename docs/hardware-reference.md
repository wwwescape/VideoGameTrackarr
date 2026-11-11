# Hardware reference catalog — image filenames

Every predefined Device/Accessory shown in the app comes from a `HardwareReferenceEntry` row (the Brand/Console/Variant cascade on Add Device/Add Accessory), seeded from `docs/data/hardware/*.csv`. Curated product photos are resolved at read time by slugifying that row's `official_name` — see `backend/app/services/hardware_reference_image_service.py`

To add a new curated image: drop a 400x400 `.png` (product centred on a white background, palette PNG) into `backend/static/hardware-reference/` using the exact filename below for that entry, then commit. No code or database change needed — the app checks the filesystem live.

**Naming rule** (if a new reference entry is added later and isn't in this list): lowercase the official name, replace every run of non-alphanumeric characters with a single hyphen, trim leading/trailing hyphens, append `.png`.

**Summary: 194 rows. Devices: 57/74 images present. Accessories: 112 missing an image.**

## Devices

| Brand | Official name | Short name | DB present | Image filename | Image present |
|---|---|---|---|---|---|
| Microsoft | Microsoft Xbox | Xbox | ✅ | `microsoft-xbox.png` | ✅ |
| Microsoft | Microsoft Xbox 360 | X360 | ✅ | `microsoft-xbox-360.png` | ✅ |
| Microsoft | Microsoft Xbox 360 E | X360 | ✅ | `microsoft-xbox-360-e.png` | ✅ |
| Microsoft | Microsoft Xbox 360 S | X360 | ✅ | `microsoft-xbox-360-s.png` | ✅ |
| Microsoft | Microsoft Xbox One | XB1 | ✅ | `microsoft-xbox-one.png` | ✅ |
| Microsoft | Microsoft Xbox One S | XB1 | ✅ | `microsoft-xbox-one-s.png` | ✅ |
| Microsoft | Microsoft Xbox One X | XB1 | ✅ | `microsoft-xbox-one-x.png` | ✅ |
| Microsoft | Microsoft Xbox Series S | Series X|S | ✅ | `microsoft-xbox-series-s.png` | ✅ |
| Microsoft | Microsoft Xbox Series X | Series X|S | ✅ | `microsoft-xbox-series-x.png` | ✅ |
| Nintendo | Family Computer | Famicom | ✅ | `family-computer.png` | ✅ |
| Nintendo | New Nintendo 2DS XL | 3DS | ✅ | `new-nintendo-2ds-xl.png` | ✅ |
| Nintendo | New Nintendo 3DS | 3DS | ✅ | `new-nintendo-3ds.png` | ✅ |
| Nintendo | New Nintendo 3DS XL | 3DS | ✅ | `new-nintendo-3ds-xl.png` | ✅ |
| Nintendo | Nintendo 2DS | 3DS | ✅ | `nintendo-2ds.png` | ✅ |
| Nintendo | Nintendo 3DS | 3DS | ✅ | `nintendo-3ds.png` | ✅ |
| Nintendo | Nintendo 3DS XL | 3DS | ✅ | `nintendo-3ds-xl.png` | ✅ |
| Nintendo | Nintendo 64 | N64 | ✅ | `nintendo-64.png` | ✅ |
| Nintendo | Nintendo DS | NDS | ✅ | `nintendo-ds.png` | ✅ |
| Nintendo | Nintendo DS Lite | NDS | ✅ | `nintendo-ds-lite.png` | ✅ |
| Nintendo | Nintendo DSi | NDS | ✅ | `nintendo-dsi.png` | ✅ |
| Nintendo | Nintendo DSi XL | NDS | ✅ | `nintendo-dsi-xl.png` | ✅ |
| Nintendo | Nintendo Entertainment System | NES | ✅ | `nintendo-entertainment-system.png` | ✅ |
| Nintendo | Nintendo Game Boy | GB | ✅ | `nintendo-game-boy.png` | ✅ |
| Nintendo | Nintendo Game Boy Advance | GBA | ✅ | `nintendo-game-boy-advance.png` | ✅ |
| Nintendo | Nintendo Game Boy Advance SP | GBA | ✅ | `nintendo-game-boy-advance-sp.png` | ✅ |
| Nintendo | Nintendo Game Boy Color | GBC | ✅ | `nintendo-game-boy-color.png` | ✅ |
| Nintendo | Nintendo Game Boy Micro | GBA | ✅ | `nintendo-game-boy-micro.png` | ✅ |
| Nintendo | Nintendo GameCube | GC | ✅ | `nintendo-gamecube.png` | ✅ |
| Nintendo | Nintendo Switch | Switch | ✅ | `nintendo-switch.png` | ✅ |
| Nintendo | Nintendo Switch 2 | Switch 2 | ✅ | `nintendo-switch-2.png` | ✅ |
| Nintendo | Nintendo Switch Lite | Switch | ✅ | `nintendo-switch-lite.png` | ✅ |
| Nintendo | Nintendo Switch – OLED Model | Switch | ✅ | `nintendo-switch-oled-model.png` | ✅ |
| Nintendo | Nintendo Wii | Wii | ✅ | `nintendo-wii.png` | ✅ |
| Nintendo | Nintendo Wii U | Wii U | ✅ | `nintendo-wii-u.png` | ✅ |
| Nintendo | Super Nintendo Entertainment System | SNES | ✅ | `super-nintendo-entertainment-system.png` | ✅ |
| Sega | Sega 32X | 32X | ✅ | `sega-32x.png` | — |
| Sega | Sega CD | SCD | ✅ | `sega-cd.png` | — |
| Sega | Sega CD 2 | SCD | ✅ | `sega-cd-2.png` | — |
| Sega | Sega CDX | Genesis | ✅ | `sega-cdx.png` | — |
| Sega | Sega Dreamcast | DC | ✅ | `sega-dreamcast.png` | — |
| Sega | Sega Game Gear | GG | ✅ | `sega-game-gear.png` | — |
| Sega | Sega Genesis | Genesis | ✅ | `sega-genesis.png` | — |
| Sega | Sega Genesis 2 | Genesis | ✅ | `sega-genesis-2.png` | — |
| Sega | Sega Genesis 3 | Genesis | ✅ | `sega-genesis-3.png` | — |
| Sega | Sega Master System | SMS | ✅ | `sega-master-system.png` | — |
| Sega | Sega Master System II | SMS | ✅ | `sega-master-system-ii.png` | — |
| Sega | Sega Mega-CD | MCD | ✅ | `sega-mega-cd.png` | — |
| Sega | Sega Mega-CD 2 | MCD | ✅ | `sega-mega-cd-2.png` | — |
| Sega | Sega Mega Drive | MD | ✅ | `sega-mega-drive.png` | — |
| Sega | Sega Mega Drive II | MD | ✅ | `sega-mega-drive-ii.png` | — |
| Sega | Sega Nomad | Genesis | ✅ | `sega-nomad.png` | — |
| Sega | Sega Saturn | SAT | ✅ | `sega-saturn.png` | — |
| Sony | Sony PSPgo | PSP | ✅ | `sony-pspgo.png` | ✅ |
| Sony | Sony PSX | PS2 | ✅ | `sony-psx.png` | ✅ |
| Sony | Sony PSone | PS1 | ✅ | `sony-psone.png` | ✅ |
| Sony | Sony PlayStation | PS1 | ✅ | `sony-playstation.png` | ✅ |
| Sony | Sony PlayStation 2 | PS2 | ✅ | `sony-playstation-2.png` | ✅ |
| Sony | Sony PlayStation 2 Slim | PS2 | ✅ | `sony-playstation-2-slim.png` | ✅ |
| Sony | Sony PlayStation 3 | PS3 | ✅ | `sony-playstation-3.png` | ✅ |
| Sony | Sony PlayStation 3 Slim | PS3 | ✅ | `sony-playstation-3-slim.png` | ✅ |
| Sony | Sony PlayStation 3 Super Slim | PS3 | ✅ | `sony-playstation-3-super-slim.png` | ✅ |
| Sony | Sony PlayStation 4 | PS4 | ✅ | `sony-playstation-4.png` | ✅ |
| Sony | Sony PlayStation 4 Pro | PS4 | ✅ | `sony-playstation-4-pro.png` | ✅ |
| Sony | Sony PlayStation 4 Slim | PS4 | ✅ | `sony-playstation-4-slim.png` | ✅ |
| Sony | Sony PlayStation 5 Digital Edition | PS5 | ✅ | `sony-playstation-5-digital-edition.png` | ✅ |
| Sony | Sony PlayStation 5 Disc Edition | PS5 | ✅ | `sony-playstation-5-disc-edition.png` | ✅ |
| Sony | Sony PlayStation 5 Pro | PS5 | ✅ | `sony-playstation-5-pro.png` | ✅ |
| Sony | Sony PlayStation 5 Slim Digital Edition | PS5 | ✅ | `sony-playstation-5-slim-digital-edition.png` | ✅ |
| Sony | Sony PlayStation 5 Slim Disc Edition | PS5 | ✅ | `sony-playstation-5-slim-disc-edition.png` | ✅ |
| Sony | Sony PlayStation Portable | PSP | ✅ | `sony-playstation-portable.png` | ✅ |
| Sony | Sony PlayStation Portal | PS5 | ✅ | `sony-playstation-portal.png` | ✅ |
| Sony | Sony PlayStation TV | PS Vita | ✅ | `sony-playstation-tv.png` | ✅ |
| Sony | Sony PlayStation Vita | PS Vita | ✅ | `sony-playstation-vita.png` | ✅ |
| Sony | Sony PocketStation | PS1 | ✅ | `sony-pocketstation.png` | ✅ |

## Accessories

| Brand | Official name | Short name | DB present | Image filename | Image present |
|---|---|---|---|---|---|
| Microsoft | Microsoft Kinect Sensor | X360 | ✅ | `microsoft-kinect-sensor.png` | — |
| Microsoft | Microsoft Kinect for Xbox One | XB1 | ✅ | `microsoft-kinect-for-xbox-one.png` | — |
| Microsoft | Microsoft Xbox 360 Chatpad | X360 | ✅ | `microsoft-xbox-360-chatpad.png` | — |
| Microsoft | Microsoft Xbox 360 Media Remote | X360 | ✅ | `microsoft-xbox-360-media-remote.png` | — |
| Microsoft | Microsoft Xbox 360 Play & Charge Kit | X360 | ✅ | `microsoft-xbox-360-play-charge-kit.png` | — |
| Microsoft | Microsoft Xbox 360 Wireless Controller | X360 | ✅ | `microsoft-xbox-360-wireless-controller.png` | — |
| Microsoft | Microsoft Xbox Adaptive Controller | Series X|S | ✅ | `microsoft-xbox-adaptive-controller.png` | — |
| Microsoft | Microsoft Xbox Controller S | Xbox | ✅ | `microsoft-xbox-controller-s.png` | — |
| Microsoft | Microsoft Xbox DVD Playback Kit | Xbox | ✅ | `microsoft-xbox-dvd-playback-kit.png` | — |
| Microsoft | Microsoft Xbox DVD Remote | Xbox | ✅ | `microsoft-xbox-dvd-remote.png` | — |
| Microsoft | Microsoft Xbox Duke Controller | Xbox | ✅ | `microsoft-xbox-duke-controller.png` | — |
| Microsoft | Microsoft Xbox Elite Wireless Controller Series 2 | Series X|S | ✅ | `microsoft-xbox-elite-wireless-controller-series-2.png` | — |
| Microsoft | Microsoft Xbox Live Communicator | Xbox | ✅ | `microsoft-xbox-live-communicator.png` | — |
| Microsoft | Microsoft Xbox Media Remote | XB1 | ✅ | `microsoft-xbox-media-remote.png` | — |
| Microsoft | Microsoft Xbox Memory Unit | Xbox | ✅ | `microsoft-xbox-memory-unit.png` | — |
| Microsoft | Microsoft Xbox Stereo Headset | XB1 | ✅ | `microsoft-xbox-stereo-headset.png` | — |
| Microsoft | Microsoft Xbox Wireless Controller | XB1 | ✅ | `microsoft-xbox-wireless-controller.png` | — |
| Microsoft | Microsoft Xbox Wireless Headset | Series X|S | ✅ | `microsoft-xbox-wireless-headset.png` | — |
| Microsoft | Xbox Storage Expansion Card | Series X|S | ✅ | `xbox-storage-expansion-card.png` | — |
| Nintendo | Nintendo Classic Controller | Wii | ✅ | `nintendo-classic-controller.png` | — |
| Nintendo | Nintendo DK Bongos | GC | ✅ | `nintendo-dk-bongos.png` | — |
| Nintendo | Nintendo Game Boy Camera | GB | ✅ | `nintendo-game-boy-camera.png` | — |
| Nintendo | Nintendo Game Boy Player | GC | ✅ | `nintendo-game-boy-player.png` | — |
| Nintendo | Nintendo Game Boy Printer | GB | ✅ | `nintendo-game-boy-printer.png` | — |
| Nintendo | Nintendo Joy-Con (Left) | Switch | ✅ | `nintendo-joy-con-left.png` | — |
| Nintendo | Nintendo Joy-Con (Right) | Switch | ✅ | `nintendo-joy-con-right.png` | — |
| Nintendo | Nintendo Joy-Con 2 (Left) | Switch 2 | ✅ | `nintendo-joy-con-2-left.png` | — |
| Nintendo | Nintendo Joy-Con 2 (Right) | Switch 2 | ✅ | `nintendo-joy-con-2-right.png` | — |
| Nintendo | Nintendo Joy-Con 2 Charging Grip | Switch 2 | ✅ | `nintendo-joy-con-2-charging-grip.png` | — |
| Nintendo | Nintendo Joy-Con Charging Grip | Switch | ✅ | `nintendo-joy-con-charging-grip.png` | — |
| Nintendo | Nintendo Leg Strap | Switch | ✅ | `nintendo-leg-strap.png` | — |
| Nintendo | Nintendo NES Zapper | NES | ✅ | `nintendo-nes-zapper.png` | — |
| Nintendo | Nintendo Nunchuk | Wii | ✅ | `nintendo-nunchuk.png` | — |
| Nintendo | Nintendo Poké Ball Plus | Switch | ✅ | `nintendo-pok-ball-plus.png` | — |
| Nintendo | Nintendo R.O.B. | NES | ✅ | `nintendo-r-o-b.png` | — |
| Nintendo | Nintendo Ring-Con | Switch | ✅ | `nintendo-ring-con.png` | — |
| Nintendo | Nintendo Rumble Pak | N64 | ✅ | `nintendo-rumble-pak.png` | — |
| Nintendo | Nintendo Super Scope | SNES | ✅ | `nintendo-super-scope.png` | — |
| Nintendo | Nintendo Switch 2 Camera | Switch 2 | ✅ | `nintendo-switch-2-camera.png` | — |
| Nintendo | Nintendo Switch 2 Pro Controller | Switch 2 | ✅ | `nintendo-switch-2-pro-controller.png` | — |
| Nintendo | Nintendo Switch Pro Controller | Switch | ✅ | `nintendo-switch-pro-controller.png` | — |
| Nintendo | Nintendo Transfer Pak | N64 | ✅ | `nintendo-transfer-pak.png` | — |
| Nintendo | Nintendo WaveBird Wireless Controller | GC | ✅ | `nintendo-wavebird-wireless-controller.png` | — |
| Nintendo | Nintendo Wii Balance Board | Wii | ✅ | `nintendo-wii-balance-board.png` | — |
| Nintendo | Nintendo Wii MotionPlus | Wii | ✅ | `nintendo-wii-motionplus.png` | — |
| Nintendo | Nintendo Wii Remote | Wii | ✅ | `nintendo-wii-remote.png` | — |
| Nintendo | Nintendo Wii U GamePad | Wii U | ✅ | `nintendo-wii-u-gamepad.png` | — |
| Nintendo | Nintendo e-Reader | GBA | ✅ | `nintendo-e-reader.png` | — |
| Sega | Sega 6-Button Arcade Pad | MD | ✅ | `sega-6-button-arcade-pad.png` | — |
| Sega | Sega Activator | MD | ✅ | `sega-activator.png` | — |
| Sega | Sega Dreamcast Arcade Stick | DC | ✅ | `sega-dreamcast-arcade-stick.png` | — |
| Sega | Sega Dreamcast Controller | DC | ✅ | `sega-dreamcast-controller.png` | — |
| Sega | Sega Dreamcast Jump Pack | DC | ✅ | `sega-dreamcast-jump-pack.png` | — |
| Sega | Sega Dreamcast Keyboard | DC | ✅ | `sega-dreamcast-keyboard.png` | — |
| Sega | Sega Dreamcast Mouse | DC | ✅ | `sega-dreamcast-mouse.png` | — |
| Sega | Sega Dreamcast VMU | DC | ✅ | `sega-dreamcast-vmu.png` | — |
| Sega | Sega Game Gear TV Tuner | GG | ✅ | `sega-game-gear-tv-tuner.png` | — |
| Sega | Sega Genesis/Mega Drive Control Pad | MD | ✅ | `sega-genesis-mega-drive-control-pad.png` | — |
| Sega | Sega Light Phaser | SMS | ✅ | `sega-light-phaser.png` | — |
| Sega | Sega Master System Control Pad | SMS | ✅ | `sega-master-system-control-pad.png` | — |
| Sega | Sega Menacer | MD | ✅ | `sega-menacer.png` | — |
| Sega | Sega Power Base Converter | MD | ✅ | `sega-power-base-converter.png` | — |
| Sega | Sega Saturn 3D Control Pad | SAT | ✅ | `sega-saturn-3d-control-pad.png` | — |
| Sega | Sega Saturn Control Pad | SAT | ✅ | `sega-saturn-control-pad.png` | — |
| Sega | Sega Saturn Memory Cartridge | SAT | ✅ | `sega-saturn-memory-cartridge.png` | — |
| Sega | Sega Saturn Mouse | SAT | ✅ | `sega-saturn-mouse.png` | — |
| Sega | Sega Saturn NetLink | SAT | ✅ | `sega-saturn-netlink.png` | — |
| Sega | Sega SegaScope 3-D Glasses | SMS | ✅ | `sega-segascope-3-d-glasses.png` | — |
| Sony | Sony Access Controller | PS5 | ✅ | `sony-access-controller.png` | — |
| Sony | Sony Blu-ray Disc Remote (PlayStation 3) | PS3 | ✅ | `sony-blu-ray-disc-remote-playstation-3.png` | ✅ |
| Sony | Sony Buzz Controller | PS2 | ✅ | `sony-buzz-controller.png` | — |
| Sony | Sony DualSense Charging Station | PS5 | ✅ | `sony-dualsense-charging-station.png` | ✅ |
| Sony | Sony DualSense Edge Controller | PS5 | ✅ | `sony-dualsense-edge-controller.png` | — |
| Sony | Sony DualSense Wireless Controller | PS5 | ✅ | `sony-dualsense-wireless-controller.png` | ✅ |
| Sony | Sony DualShock 2 Controller | PS2 | ✅ | `sony-dualshock-2-controller.png` | — |
| Sony | Sony DualShock 3 Wireless Controller | PS3 | ✅ | `sony-dualshock-3-wireless-controller.png` | ✅ |
| Sony | Sony DualShock 4 Wireless Controller | PS4 | ✅ | `sony-dualshock-4-wireless-controller.png` | ✅ |
| Sony | Sony DualShock Controller | PS1 | ✅ | `sony-dualshock-controller.png` | — |
| Sony | Sony EyeToy Camera | PS2 | ✅ | `sony-eyetoy-camera.png` | — |
| Sony | Sony HD Camera | PS5 | ✅ | `sony-hd-camera.png` | — |
| Sony | Sony PSone LCD Monitor | PS1 | ✅ | `sony-psone-lcd-monitor.png` | — |
| Sony | Sony PULSE 3D Wireless Headset | PS5 | ✅ | `sony-pulse-3d-wireless-headset.png` | ✅ |
| Sony | Sony PULSE Elite Wireless Headset | PS5 | ✅ | `sony-pulse-elite-wireless-headset.png` | — |
| Sony | Sony PULSE Explore Wireless Earbuds | PS5 | ✅ | `sony-pulse-explore-wireless-earbuds.png` | — |
| Sony | Sony PlayStation 2 Game Disc | PS2 | ✅ | `sony-playstation-2-game-disc.png` | — |
| Sony | Sony PlayStation 2 Memory Card | PS2 | ✅ | `sony-playstation-2-memory-card.png` | — |
| Sony | Sony PlayStation 2 Multitap | PS2 | ✅ | `sony-playstation-2-multitap.png` | — |
| Sony | Sony PlayStation 2 Network Adaptor | PS2 | ✅ | `sony-playstation-2-network-adaptor.png` | — |
| Sony | Sony PlayStation 3 Game Disc | PS3 | ✅ | `sony-playstation-3-game-disc.png` | — |
| Sony | Sony PlayStation Camera | PS4 | ✅ | `sony-playstation-camera.png` | — |
| Sony | Sony PlayStation Controller | PS1 | ✅ | `sony-playstation-controller.png` | — |
| Sony | Sony PlayStation Disc Drive | PS5 | ✅ | `sony-playstation-disc-drive.png` | — |
| Sony | Sony PlayStation Eye Camera | PS3 | ✅ | `sony-playstation-eye-camera.png` | — |
| Sony | Sony PlayStation Game Disc | PS1 | ✅ | `sony-playstation-game-disc.png` | — |
| Sony | Sony PlayStation Link USB Adapter | PS5 | ✅ | `sony-playstation-link-usb-adapter.png` | — |
| Sony | Sony PlayStation Media Remote (PlayStation 2) | PS2 | ✅ | `sony-playstation-media-remote-playstation-2.png` | — |
| Sony | Sony PlayStation Media Remote (PlayStation 4) | PS4 | ✅ | `sony-playstation-media-remote-playstation-4.png` | ✅ |
| Sony | Sony PlayStation Media Remote (PlayStation 5) | PS5 | ✅ | `sony-playstation-media-remote-playstation-5.png` | ✅ |
| Sony | Sony PlayStation Memory Card | PS1 | ✅ | `sony-playstation-memory-card.png` | — |
| Sony | Sony PlayStation Mouse | PS1 | ✅ | `sony-playstation-mouse.png` | — |
| Sony | Sony PlayStation Move Motion Controller | PS3 | ✅ | `sony-playstation-move-motion-controller.png` | — |
| Sony | Sony PlayStation Move Navigation Controller | PS3 | ✅ | `sony-playstation-move-navigation-controller.png` | — |
| Sony | Sony PlayStation Move Sharp Shooter | PS3 | ✅ | `sony-playstation-move-sharp-shooter.png` | — |
| Sony | Sony PlayStation Move Shooting Attachment | PS3 | ✅ | `sony-playstation-move-shooting-attachment.png` | — |
| Sony | Sony PlayStation Multitap | PS1 | ✅ | `sony-playstation-multitap.png` | — |
| Sony | Sony PlayStation Portable Camera | PSP | ✅ | `sony-playstation-portable-camera.png` | — |
| Sony | Sony PlayStation Portable GPS Receiver | PSP | ✅ | `sony-playstation-portable-gps-receiver.png` | — |
| Sony | Sony PlayStation Portable Microphone | PSP | ✅ | `sony-playstation-portable-microphone.png` | — |
| Sony | Sony PlayStation Portable UMD | PSP | ✅ | `sony-playstation-portable-umd.png` | — |
| Sony | Sony PlayStation VR Aim Controller | PS4 | ✅ | `sony-playstation-vr-aim-controller.png` | — |
| Sony | Sony PlayStation VR Camera Adapter | PS1 | ✅ | `sony-playstation-vr-camera-adapter.png` | — |
| Sony | Sony PlayStation VR Headset | PS1 | ✅ | `sony-playstation-vr-headset.png` | — |
| Sony | Sony PlayStation VR Processor Unit | PS4 | ✅ | `sony-playstation-vr-processor-unit.png` | — |
| Sony | Sony PlayStation VR2 Headset | PS5 | ✅ | `sony-playstation-vr2-headset.png` | — |
| Sony | Sony PlayStation VR2 Sense Controller (Left) | PS5 | ✅ | `sony-playstation-vr2-sense-controller-left.png` | — |
| Sony | Sony PlayStation VR2 Sense Controller (Right) | PS5 | ✅ | `sony-playstation-vr2-sense-controller-right.png` | — |
| Sony | Sony PlayStation VR2 Sense Controller Charging Station | PS5 | ✅ | `sony-playstation-vr2-sense-controller-charging-station.png` | — |
| Sony | Sony PlayStation Vita Game Card | PS Vita | ✅ | `sony-playstation-vita-game-card.png` | — |
| Sony | Sony SIXAXIS Controller | PS3 | ✅ | `sony-sixaxis-controller.png` | — |
| Sony | Sony SingStar Microphone | PS2 | ✅ | `sony-singstar-microphone.png` | — |
