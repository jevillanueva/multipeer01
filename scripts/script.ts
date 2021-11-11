import Scene from 'Scene';
import Diagnostics from 'Diagnostics';
import Reactive from 'Reactive'
import Multipeer from 'Multipeer'
import Patches from 'Patches'

(async function () {  // Enables async/await in JS [part 1]
    const totalBackgroundCount = 3;
    var backgroundIndex = 0;

    const triggerPulseRequest = await Patches.outputs.getPulse('triggerPulseRequest');
    const syncBGChannel = Multipeer.getMessageChannel('syncBGTopic')

    triggerPulseRequest.subscribe(() => {
        Diagnostics.log("Touch");

        backgroundIndex++;
        if (backgroundIndex >= totalBackgroundCount) {
            backgroundIndex = 0
        }
        Patches.inputs.setScalar("msg_background", backgroundIndex);

        syncBGChannel.sendMessage({ "background": backgroundIndex }, true).catch(err => {
            Diagnostics.log(err);
        })
    });

    // When we receive a message on the syncBGChannel, change our background
    syncBGChannel.onMessage.subscribe((msg) => {
        // 'msg' is the JSON data object and 'background' is the attribute we want to access
        backgroundIndex = msg.background;
        Patches.inputs.setScalar('msg_background', msg.background);
    });
})(); // Enables async/await in JS [part 2]
