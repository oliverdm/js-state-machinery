# js-state-machinery

JavaScript state machine with nested states.

### Features

 * Nested states
 * Enter and exit state callbacks
 * Optional guard functions for transitions
 * Transitions can be asynchronous

### Example

```
var fsm = new FsmMachine([
    new FsmState('opened', {
        transitions: [
            new FsmTransition('close', 'closed'),
        ],
        onExit: function(context, type, targetState, done){
            // when exiting opened state
            // the fourth argument is optional and can be declared
            // for asynchronous operation
            setTimeout(done, 400);
        }
        onEnter: function(context, type, activeState){
            // when entering opened state
        },
    }),
    new FsmState('closed', {
        transitions: [
            new FsmTransition('open', 'opened'),
            new FsmTransition('lock', 'closed.locked')
        ],
        // child states
        states: [
            new FsmState('locked', {
                transitions: [
                    new FsmTransition('open', 'opened', {
                        guard: function(context, type, activeState) {
                            return context.key === context.secret;
                        },
                        stopPropagation: true
                    });
                ]
            })
        ]
    })
], {
    secret: 'secr3t'
});

fsm.on('change', function(detail){
    console.log(detail.oldState, '=>', detail.newState);
});
fsm.init('closed.locked');
fsm.fireStateEvent('open', {key: 'secr3t'});
```