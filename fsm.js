(function(global){

/**
 * Helper functions/polyfills
 */
var util = {
    Array: {
        isArray: function(arr){
            if (Array.isArray) {
                return Array.isArray(arr);
            } else {
                return Object.prototype.toString.call(arr) === '[object Array]';
            }
        }
    },
    Number: {
        isInteger: function(value){
            if (Number.isInteger) {
                return Number.isInteger(value);
            } else {
                return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
            }
        }
    },
    Object: {
        assign: function(){
            var args = Array.prototype.slice.call(arguments);
            if (!args.length || !args[0]) {
                throw new TypeError("Cannot convert first argument to object");
            }
            if (Object.assign) {
                return Object.assign.apply(args[0], args);
            } else {
                var target = args[0];
                for (var i = 1, len = args.length; i < len; i++) {
                    var src = args[i];
                    Object.keys(src).forEach(function(key){
                        target[key] = src[key];
                    });
                }
                return target;
            }
        }
    }
};

/**
 * State machine prototype
 * @param {array} states an array of state objects, all states must be set
 * during creation of the instance
 * @param {object} context optional, an object that is passed to callbacks, can
 * be used to inject variables, functions
 * @param {object} options optional, an object with options:
 * <ul>
 *   <li>{boolean} debug: if set to true debug output is written to console,
 *       defaults to false
 *   </li>
 * </ul>
 */
function StateMachine(states, context, options) {
    this._states = util.Array.isArray(states) ? states : [];
    this._context = Object.prototype.toString.call(context) === '[object Object]' ? context : {};
    this._activeState = null;
    this._listeners = [];
    this._opts = {
        'debug': false
    };
    if (Object.prototype.toString.call(options) === '[object Object]') {
        util.Object.assign(this._opts, options);
    }
}
/**
 * @property {array} states read-only, all state objects as an array
 */
Object.defineProperty(StateMachine.prototype, 'states', {
    get: function(){
        return this._states;
    }
});
/**
 * @property {string} activeState read-only, the full name of the active state 
 */
Object.defineProperty(StateMachine.prototype, 'activeState', {
    get: function(){
        return this._collapseStateName(this._activeState);
    }
});
/**
 * Logs arguments to console
 */
StateMachine.prototype._log = function(){
    this._opts['debug'] && console.log.apply(console, arguments);
};
/**
 * Logs arguments to console as warning
 */
StateMachine.prototype._warn = function(){
    this._opts['debug'] && console.warn.apply(console, arguments);
};
/**
 * Registers a listener for a given type
 * @param {string} type the event type
 * @param {function} fn the listener function
 */
StateMachine.prototype._registerListener = function(type, fn){
    if (!(type in this._listeners)) {
        this._listeners[type] = [];
    }
    if (this._listeners[type].indexOf(fn) === -1) {
        this._listeners[type].push(fn);
    }
};
/**
 * Removes the given listener for a specific type
 * @param {string} type the event type
 * @param {function} fn the listener function
 */
StateMachine.prototype._removeListener = function(type, fn){
    if (type in this._listeners) {
        var idx = this._listeners[type].indexOf(fn);
        if (idx !== -1) {
            this._listeners[type].splice(idx, 1);
        }
    }
};
/**
 * Invokes the listeners for the given type.
 * All arguments to this function beyond the first are passed on to the listener
 * functions.
 * @param {string} type the event type
 */
StateMachine.prototype._invokeListeners = function(type){
    var args = Array.prototype.slice.call(arguments, 1);
    if (type in this._listeners) {
        this._listeners[type].forEach(function(fn){
            fn.apply(fn, args);
        });
    }
};
/**
 * Registers an event listener for the given type.
 * @param {string} type the event type
 * @param {function} fn the listener function
 * @returns {object} an object with a <code>cancel</code> method to stop listening
 */
StateMachine.prototype['on'] = function(type, fn){
    if (Object.prototype.toString.call(type) === '[object String]' &&
            Object.prototype.toString.call(fn) === '[object Function]') {
        this._registerListener(type, fn);
        return {
            cancel: function(){
                this._removeListener(type, fn);
            }.bind(this)
        };
    }
};
/**
 * Takes a fully qualified state name (one or more state names separated by dots)
 * and returns an array of matching state objects.
 * Example: "foo.bar" as argument will return an array of two state objects
 * ("foo" and "bar") if the following conditions are met:
 * <ul>
 *   <li>the "foo" state exists and has no parent state</li>
 *   <li>the "bar" state exists as a child of the "foo" state</li>
 * </ul>
 * @param {type} name the full state name
 * @param {array} _states used internally for recursion to pass in available
 * states at the current level
 * @param {array} _stack used internally for recursion to pass on parent state
 * objects
 * @returns {array} On success an array of state objects is returned in the 
 * same order as the name. If one or more states cannot be found, an empty array
 * is returned.
 */
StateMachine.prototype._resolveStateName = function(name, _states, _stack){
    _states = typeof _states === 'undefined' ? this._states : _states;
    _stack = typeof _stack === 'undefined' ? [] : _stack;

    if (name && Object.prototype.toString.call(name) === '[object String]') {
        var nameSplitted = name.split('.');
        for (var i = 0, len = _states.length; i < len; i++) {
            if (_states[i]._name === nameSplitted[0]) {
                _stack.push(_states[i]);
                if (nameSplitted.length === 1) {
                    return _stack;
                }
                else {
                    return this._resolveStateName(nameSplitted.slice(1).join('.'), _states[i]._children(), _stack);
                }
                break;
            }
        }
    }
    return [];
};
/**
 * Reverse of <code>_resolveStateName()</code>.
 * Takes an array of state objects and returns the full name of the last state
 * in the series.
 * This function throws an error if a state is not a child of the preceeding
 * state.
 * @param {array} states array of state objects that are connected through
 * parent-child relationships
 * @returns {string} the full name of the last state
 */
StateMachine.prototype._collapseStateName = function(states){
    var names = [];
    if (util.Array.isArray(states)) {
        var prevState = null;
        states.forEach(function(state){
            if (!prevState) {
                names.push(state._name);
            } else if (prevState._children().indexOf(state) === -1) {
                throw new Error('State "' + state._name + '" must be a child of "' + prevState._name + '"');
            } else {
                names.push(state._name);
            }
            prevState = state;
        });
    }
    return names.join('.');
};
/**
 * Creates a new context object from the given context and the context set in
 * the state machine instance.
 * @param {object} context an object
 * @returns {object} new and merged context object
 */
StateMachine.prototype._mergeContext = function(context){
    return util.Object.assign({}, this._context, Object.prototype.toString.call(context) === '[object Object]' ? context : {});
};
/**
 * Changes the <code>_activeState</code> property and fires the
 * <code>change</code> event.
 * @param {array} state the new state as an array that includes all parent state
 * objects
 */
StateMachine.prototype._changeActiveState = function(state){
    var oldStateName = this._collapseStateName(this._activeState);
    var newStateName = this._collapseStateName(state);
    this._activeState = state;
    this._invokeListeners('change', {
        oldState: oldStateName,
        newState: newStateName
    });
};
/**
 * Invokes a function on each of the given state object.
 * The hook argument denotes the function that is invoked.
 * The order of invocation is defined by the states array.
 * Hook functions can be asynchronous, therefore this functions accepts a
 * callback that is called when complete.
 * @param {string} hook the name of the function to be invoked on each state
 * @param {type} states an array of state objects
 * @param {type} event the event object that is passed in as first argument to
 * every hook invocation
 * @param {type} done optional callback when complete
 */
StateMachine.prototype._invokeStateHook = function(hook, states, event, done){
    var idx = 0,
        len = states.length;
    function invokeHook(){
        if (idx < len) {
            states[idx][hook](event, function(){
                idx++;
                invokeHook();
            });
        } else if (Object.prototype.toString.call(done) === '[object Function]') {
            done(states);
        }
    }
    invokeHook();
};
/**
 * Initializes the state machine with the given state.
 * Throws an error if the given name is invalid, the state cannot be found or if
 * the state machine is already initialized.
 * @param {string} stateName the name of the initial state
 * @param {object} context optional context object that is passed to callbacks
 * of the state object
 * @param {function} callback optional callback that is called once
 * initialization is complete
 */
StateMachine.prototype['init'] = function(stateName, context, callback){
    if (!stateName || Object.prototype.toString.call(stateName) !== '[object String]') {
        throw new Error('Invalid state name: ' + stateName);
    }
    else if (this._activeState) {
        throw new Error('StateMachine already initialized');
    }
    // context is optional
    if (["function", "undefined"].indexOf(typeof context) >= 0) {
        callback = context;
        context = {};
    }
    var targetState = this._resolveStateName(stateName);
    if (!targetState.length) {
        throw new Error('State not found: ' + stateName);
    }
    this._log('INIT STATE:', stateName);
    var event = new StateEvent('init', '', this._mergeContext(context));
    // invoke enter callbacks for each state in order: parent states first
    var _this = this;
    this._invokeStateHook('_enter', targetState, event, function(){
        _this._changeActiveState(targetState);
        callback && callback();
    });
};
/**
 * Triggers a state event of the given type.
 * If the event results in a change of the active state the <code>change</code>
 * event is triggered.
 * @param {string} type the event type
 * @param {object} context optional context object that is passed to callbacks
 * of the state object
 */
StateMachine.prototype['fireStateEvent'] = function(type, context){
    if (!type || Object.prototype.toString.call(type) !== '[object String]') {
        throw new Error('Invalid event type: ' + type);
    }
    if (!util.Array.isArray(this._activeState) || !this._activeState.length) {
        this._warn('NO CURRENT STATE. EVENT DROPPED:', type);
        return;
    }
    // construct event object
    var event = new StateEvent(type,
        this._collapseStateName(this._activeState),
        this._mergeContext(context)
    );
    // invoke event handlers of current states
    var activeState = this._activeState.slice(),
        activeStateName = this._collapseStateName(activeState);
    activeState.reverse();
    activeState.some(function(state){
        if (event.cancelled) {
            return true;
        }
        state._handleStateEvent(event);
    });
    // find target state
    var targetState;
    if (event.targetState) {
        targetState = this._resolveStateName(event.targetState);
    }
    if (util.Array.isArray(targetState) && targetState.length) {
        var _this = this;
        function transition() {
            // exit old state
            _this._log('EXIT STATE:', activeStateName);
            _this._invokeStateHook('_exit', activeState, event, function(){
                // enter new state and change current state
                _this._log('ENTER STATE:', _this._collapseStateName(targetState));
                _this._invokeStateHook('_enter', targetState, event, _this._changeActiveState.bind(_this));
            });
        }
        // void the current state to prevent simultaneous events interfering
        this._activeState = null;
        // delay transition
        if (event.delay === 0) {
            this._log('ASYNC TRANSITION', 0);
            requestAnimationFrame(transition);
        } else if (event.delay > 0) {
            this._log('ASYNC TRANSITION', event.delay);
            setTimeout(transition, event.delay);
        } else {
            transition();
        }
    } else {
        this._log('NO TARGET STATE:', event.targetState);
    }
};

/**
 * State prototype
 * @param {string} name the name of the state
 * @param {object} options optional object with options:
 * <ul>
 *   <li>{array} states: array of child states</li>
 *   <li>{array} transitions: array of transitions</li>
 *   <li>{function} onEnter: callback when this state becomes the active state.
 *       The callback function receives the following arguments:
 *       <ul>
 *          <li>{object} context: a context object</li>
 *          <li>{string} type: the event type that triggered the change</li>
 *          <li>{string} activeState: the name of the currently active state</li>
 *          <li>{function} done: optional callback that must be invoked when
 *              defined as argument that allows for asynchronous execution</li>
 *       </ul>
 *   </li>
 *   <li>{function} onExit: callback when this state is no longer the active state.
 *       The callback function receives the following arguments:
 *       <ul>
 *          <li>{object} context: a context object</li>
 *          <li>{string} type: the event type that triggered the change</li>
 *          <li>{string} targetState: the name of the new state</li>
 *          <li>{function} done: optional callback that must be invoked when
 *              defined as argument that allows for asynchronous execution</li>
 *       </ul>
 *   </li>
 * </ul>
 */
function State(name, options) {
    this._name = name;
    this._opts = {
        'states': [],
        'transitions': [],
        'onEnter': null,
        'onExit': null
    };
    if (Object.prototype.toString.call(options) === '[object Object]') {
        util.Object.assign(this._opts, options);
    }
}
/**
 * Returns the immediate child states.
 * @returns {array} an array of state objects, may be empty
 */
State.prototype._children = function(){
    return util.Array.isArray(this._opts['states']) ? this._opts['states'] : [];
};
/**
 * Returns all transitions that can handle the given event type.
 * @param {string} eventType the event type
 * @returns {array} transitions that can handle the given type
 */
State.prototype._transitionsForType = function(eventType){
    var allTransitions = this._opts['transitions'];
    var handlers = [];
    if (!util.Array.isArray(allTransitions)) {
        return handlers;
    }
    allTransitions.forEach(function(transition){
        if (eventType === transition._type) {
            handlers.push(transition);
        }
        else if (util.Array.isArray(transition._type) && transition._type.indexOf(eventType) !== -1) {
            handlers.push(transition);
        }
    });
    return handlers;
};
/**
 * Tests all transitions with the given event.
 * The event object's <code>targetState</code> and <code>delay</code> properties
 * are changed whenever a transition tests successfully.
 * Transitions can also invoke <code>stopPropgation()</code> on the event
 * without testing successfully.
 * If a transition has the <code>stopImmediatePropagation</code> flag set
 * execution stops after that transition.
 * @param {object} event the state event
 */
State.prototype._handleStateEvent = function(event){
    var transitions = this._transitionsForType(event.type);
    transitions.some(function(transition){
        if (transition._test(event)) {
            event.transition(transition._targetState, transition._opts.delay);
        }
        if (transition._opts.stopPropagation) {
            event.stopPropagation();
        }
        if (transition._opts.stopImmediatePropagation) {
            event.stopPropagation();
            return true;
        }
    });
};
/**
 * Invokes the <code>onEnter</code> callback.
 * @param {object} event the state event
 * @param {function} done callback function that is invoked without arguments
 * when complete
 */
State.prototype['_enter'] = function(event, done){
    var onEnter = this._opts['onEnter'];
    if (Object.prototype.toString.call(onEnter) === '[object Function]') {
        // the enter function can optionally take a callback
        // argument to be invoked at a later point
        var args = [event.context, event.type, event.activeState];
        if (onEnter.length > 3) {
            args.push(done);
            onEnter.apply(onEnter, args);
        } else {
            onEnter.apply(onEnter, args);
            done();
        }
    } else {
        done();
    }
};
/**
 * Invokes the <code>onExit</code> callback.
 * @param {object} event the state event
 * @param {function} done callback function that is invoked without arguments
 * when complete
 */
State.prototype['_exit'] = function(event, done){
    var onExit = this._opts['onExit'];
    if (Object.prototype.toString.call(onExit) === '[object Function]') {
        // optional callback: see enter
        var args = [event.context, event.type, event.targetState];
        if (onExit.length > 3) {
            args.push(done);
            onExit.apply(onExit, args);
        } else {
            onExit.apply(onExit, args);
            done();
        }
    } else {
        done();
    }
};

/**
 * State transition prototype.
 * Given a certain event, a transition causes the state machine to transition
 * from the state, on which it is defined, to a target state.
 * @param {string|array} eventType the event type or an array of event types
 * @param {string} targetState the full name of the target state
 * @param {object} options optional object with options:
 * <ul>
 *   <li>{function} guard: a function that can return a truthy value to allow
 *        the transition or a falsy value to deny it.
 *        The guard function receives the following arguments:
 *        <ul>
 *          <li>{object} context: a context object</li>
 *          <li>{string} type: the event type that triggered the change</li>
 *          <li>{string} activeState: the name of the currently active state</li>
 *        </ul>
 *   </li>
 *   <li>{number} delay: the amount of milliseconds to delay the transition.
 *       No delay for values smaller zero, delay of one frame if value is zero,
 *       or longer delays for values greater zero.
 *   </li>
 *   <li>{boolean} stopPropagation: if true execution stops after this state</li>
 *   <li>{boolean} stopImmediatePropagation: if true execution stops after this
 *       transition
 *   </li>
 * </ul>
 */
function Transition(eventType, targetState, options) {
    this._type = eventType;
    this._targetState = targetState;
    this._opts = {
        'guard': null,
        'delay': -1,
        'stopPropagation': false,
        'stopImmediatePropagation': false
    };
    if (Object.prototype.toString.call(options) === '[object Object]') {
        util.Object.assign(this._opts, options);
    }
}
/**
 * Tests this transition with the given event.
 * If no guard function is defined the result is always <code>true</code>.
 * @param {object} event a state event object
 * @returns {boolean} true this transition is allowed, or false otherwise
 */
Transition.prototype._test = function(event){
    var guardFn = this._opts['guard'];
    if (Object.prototype.toString.call(guardFn) !== '[object Function]') {
        return true;
    }
    return guardFn(event.context, event.type, event.activeState) ? true : false;
};

/**
 * State event prototype.
 * State event objects are containers for values that are passed between state
 * objects and associated callbacks.
 * State events itself are not part of the public API but their values are.
 * @param {string} type the event type
 * @param {string} activeState full name of the active state
 * @param {object} context a context object
 */
function StateEvent(type, activeState, context) {
    this.type = type;
    this.activeState = activeState;
    this.context = context;
    this.delay = -1;
    this.cancelled = false;
    this.targetState = null;
}
/**
 * Sets the target state and optional delay.
 * @param {string} targetState the full name of the target state
 * @param {number} delay optional delay as integer of milliseconds
 */
StateEvent.prototype.transition = function(targetState, delay){
    this.targetState = targetState;
    if (util.Number.isInteger(delay)) {
        this.delay = delay;
    }
};
/**
 * Sets the <code>cancelled</code> property to <code>true</code>.
 */
StateEvent.prototype.stopPropagation = function(){
    this.cancelled = true;
};
    
// export prototypes
global['FsmMachine'] = StateMachine;
global['FsmState'] = State;
global['FsmTransition'] = Transition;
global['FsmEvent'] = StateEvent;
    
})(window);