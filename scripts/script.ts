import Scene from 'Scene';
import Diagnostics from 'Diagnostics';
import Reactive from 'Reactive'
import Multipeer from 'Multipeer'
import Patches from 'Patches'
import Participants from "Participants";
import Time from 'Time'
var activeParticipants = [];
var turnIndex = 0;
(async function () {  // Enables async/await in JS [part 1]

    const self = await Participants.self;
    const participants = await Participants.getAllOtherParticipants();
    participants.push(self);

    const totalBackgroundCount = 3;
    var backgroundIndex = 0;

    const syncBGChannel = Multipeer.getMessageChannel('syncBGTopic')
    const syncTurnChannel = Multipeer.getMessageChannel('SyncTurnTopic');

    const triggerPulseRequest = await Patches.outputs.getPulse('triggerPulseRequest');
    const turnPulseRequest = await Patches.outputs.getPulse('turnPulseRequest');

    participants.forEach(function (participant) {
        participant.isActiveInSameEffect.monitor().subscribeWithSnapshot({
            userIndex: Reactive.val(participants.indexOf(participant)),
        }, function (event, snapshot) {
            onUserEnterOrLeave(snapshot.userIndex, event.newValue);
        });
        activeParticipants.push(participant);
    });

    Participants.onOtherParticipantAdded().subscribe(function (participant) {
        participants.push(participant);
        participant.isActiveInSameEffect.monitor().subscribeWithSnapshot({
            userIndex: participants.indexOf(participant),
        }, function (event, snapshot) {
            onUserEnterOrLeave(snapshot.userIndex, event.newValue);
        });
    })
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

    syncTurnChannel.onMessage.subscribe(function (msg) {
        turnIndex = msg.turnIndex;
        checkShowTurnPanel();
    });

    sortActiveParticipantList();
    checkShowTurnPanel();

    turnPulseRequest.subscribe(() => {
        if (activeParticipants[turnIndex].id == self.id) {
            turnIndex = (turnIndex + 1) % activeParticipants.length;
            checkShowTurnPanel();

            syncTurnChannel.sendMessage({ 'turnIndex': turnIndex }, false).catch(err => {
                Diagnostics.log(err);
            })
        }
    });




    // OTHER FUNCTIONS
    function sortActiveParticipantList() {

        activeParticipants.sort(function (a, b) {

            if (a.id < b.id) {
                return -1;
            }

            if (a.id > b.id) {
                return 1;
            }
        });
    }

    function checkShowTurnPanel() {

        // Check if this participant's ID matches the ID in the turn index
        let isMyTurn = activeParticipants[turnIndex].id === self.id;

        // Send the returned boolean value to the Patch Editor and assign it to 
        // the showTurnPanel boolean
        Patches.inputs.setBoolean('showTurnPanel', isMyTurn);
    }

    function onUserEnterOrLeave(userIndex, isActive) {
        let participant = participants[userIndex];
        let currentTurnParticipant = activeParticipants[turnIndex];

        if (isActive) {
            Diagnostics.log("User Entered the Effect");
            activeParticipants.push(participant);

            Time.setTimeout(function () {
                syncBGChannel.sendMessage({ 'background': backgroundIndex }, false).catch(err => {
                    Diagnostics.log(err);
                });
            }, 1000);
        } else {
            Diagnostics.log("User Left the effect");

            let activeIndex = activeParticipants.indexOf(participant);
            activeParticipants.splice(activeIndex, 1)
        }
        sortActiveParticipantList();

        if (activeParticipants.includes(currentTurnParticipant)) {
            turnIndex = activeParticipants.indexOf(currentTurnParticipant);
        } else {
            turnIndex = turnIndex % activeParticipants.length;
        }
        checkShowTurnPanel();

    }


})(); // Enables async/await in JS [part 2]
