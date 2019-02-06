import React from 'react';
import ReactDOM from 'react-dom';
import ReactCSSTransitionGroup from 'react-addons-css-transition-group';
import './index.css';


class EventSingleton
{
    constructor()
    {
        if(!EventSingleton.instance)
        {
            this.EVENTS = {BREAKFAST_CYCLIC_UPDATE: undefined, LOGON_FAILED: undefined, LOGON_CORRECT: undefined};
            Object.keys(this.EVENTS).forEach(element => {
                let customEvent = new CustomEvent(element);
                this.EVENTS[element] = customEvent;
            });
            EventSingleton.instance = this;
        }

        return EventSingleton.instance;
    }

    subscribeToEvent(event_name, callback)
    {
        document.body.addEventListener(event_name, callback, false);
    }

    triggerEvent(event_name)
    {
        document.body.dispatchEvent(this.EVENTS[event_name]);
    }
}


class App extends React.Component
{
    constructor(props)
    {
        super(props);
        let eventSingleton = new EventSingleton();
    }

    render()
    {
        return(
            <div class="main-div">
                <CurrentBreakfast />
                <UserQueue />
                <ConfirmationPanel />
            </div>
        );
    }
}


class CurrentBreakfast extends React.Component
{
    updateBreakfastState(responseText)
    {
        let json = JSON.parse(responseText);
        let temp_state = this.state;

        temp_state.breakfastDate = json.date;
        temp_state.breakfastMaker = (json.done_by === '')?'No one yet':json.done_by;

        this.setState(temp_state);

        let eventSingleton = new EventSingleton();
        eventSingleton.triggerEvent('BREAKFAST_CYCLIC_UPDATE');
    }

    constructor(props)
    {
        super(props);
        this.state = {breakfastDate: '', breakfastMaker: ''};
        breakfastRequest((text)=>this.updateBreakfastState(text));
        setInterval(()=>(breakfastRequest((text)=>this.updateBreakfastState(text))), 200);
    }

    render()
    {
        return(
            <div class={"next-breakfast-div"}>
                <ReactCSSTransitionGroup transitionName="simple" transitionEnterTimeout={1000} transitionLeaveTimeout={300}>
                <p class={"big-text"}>{"Next breakfast date: "}</p>
                {this.state.breakfastDate != ''?
                <p class={"medium-text important"} key="date">{this.state.breakfastDate}</p>
                :<p></p>
                }
                <p class={"big-text"}>{"Will make: "}</p>
                {this.state.breakfastMaker != ''?
                <p class={"medium-text important"} key="user">{this.state.breakfastMaker}</p>
                :<p></p>
                }
                </ReactCSSTransitionGroup>
            </div>
        );
    }
}

class UserQueue extends React.Component
{
    updateQueue()
    {
        for(let i = 0; i < this.state.queue.length; i++)
        {
            queueRequest((jsonText)=>{
                let json = JSON.parse(jsonText);
                let temp_state = this.state;
                temp_state.queue[i] = {name: json.name+" "+json.surname, done_already: json.queue_count};
                this.setState(temp_state);
            }
            ,i);
        }
    }

    constructor(props)
    {
        super(props);
        this.state = {queue: new Array(10)};
        this.updateQueue();
        let eventSingleton = new EventSingleton();
        eventSingleton.subscribeToEvent('BREAKFAST_CYCLIC_UPDATE', (data)=>this.updateQueue());
        eventSingleton.subscribeToEvent('LOGON_CORRECT', (data)=>this.updateQueue());
    }

    render()
    {

        if(this.state.queue.every((value)=>value!==undefined))
        {
            let queue = [];
            this.state.queue.forEach((q, index) => {
                queue.push(<tr><td>{index}</td><td>{q.name}</td><td>{q.done_already}</td></tr>);
            });
            return(
                <div class="queue-div">
                <p class="big-text">Maker queue:</p>
                    <table class="queue-table">
                    <tr>
                        <th>ln</th>
                        <th>name</th>
                        <th>breakfasts done</th>
                    </tr>
                    {queue}
                    </table>
                </div>
            );
        }
        else{
            return(
                <div></div>
            );
        }
    }
}

class ConfirmationPanel extends React.Component
{
    constructor(props)
    {
        super(props);
        this.state = {activated: false, loading_user: false, loaded_user: undefined, current_selection: 0, send_popup: false, logon_failed: false, success_animation: false}
        this.reloadUser();

        let eventSingleton = new EventSingleton();
        eventSingleton.subscribeToEvent('LOGON_CORRECT', (data)=>{
            this.setState({send_popup: false, logon_failed: false, success_animation: true});
            this.reloadUser();
        });
        eventSingleton.subscribeToEvent('LOGON_FAILED', (data)=>{this.setState({logon_failed: true})});
    }

    confirmUser()
    {
        let form_to_send = document.getElementById('confirmUserForm');
        let login = form_to_send.login.value;
        let password = form_to_send.password.value;
        confirmUserRequest((text)=>{
            let json = JSON.parse(text);
            let eventSingleton = new EventSingleton();
            if(json.correct_logon)
            {
                eventSingleton.triggerEvent('LOGON_CORRECT');
            }else{
                
                eventSingleton.triggerEvent('LOGON_FAILED');
            }
        }, login, password, this.state.current_selection);
    }

    reloadUser(new_selection=undefined)
    {
        this.setState({loaded_user: undefined, loading_user: true, current_selection: new_selection!=undefined?new_selection:this.state.current_selection});
        queueRequest((text)=>{
            let json = JSON.parse(text);
            this.setState({loaded_user: json, loading_user: false});
        }, new_selection!=undefined? new_selection : this.state.current_selection)
    }

    changeSelection(decrase=false)
    {
        let new_selection = decrase ? Math.max(0, this.state.current_selection-1) : this.state.current_selection+1;
        this.reloadUser(new_selection);
    }


    panelDiv()
    {
        
        let ret_stack = [];
        if(this.state.activated)
        {
           return(<div class="confirmation-panel-div">
           <div class="center">
           <table class="user-navigation">
                <tr>
                    <td class="left">
                        {(this.state.current_selection > 0) ? 
                            <a key="decrement-button" href="#" onClick={(data)=>this.changeSelection(true)} class="left-user-selection-button button6">{"-"}</a>
                            :<div class="left-user-selection-button"></div>
                        }
                    </td>
                    <td class="middle">
                        <table class="user-preview">
                        <tr>
                            <th>name</th>
                            <th>breakfast done</th>
                        </tr>
                        {(this.state.loading_user) ? 
                            <tr>
                                <td>LOADING</td>
                                <td>LOADING</td>
                            </tr>
                            :<tr>
                                <td>{this.state.loaded_user.name+" "+this.state.loaded_user.surname}</td>
                                <td>{this.state.loaded_user.queue_count}</td>
                            </tr>
                        }
                        </table>
                    </td>
                    <td class="right">
                        <a key="increment-button" href="#" onClick={(data)=>this.changeSelection()} class="right-user-selection-button button6">{"+"}</a>
                    </td>
                </tr>
            </table>
            </div>
                    <a key="send-confirmation-button" href="#" onClick={(event)=>this.setState({send_popup: true, success_animation: false})} class="new-line button6">
                        {"SEND CONFIRMATION"}
                    </a>
                </div>
           );
        }
        
        return(<div></div>);
    }

    managePopup()
    {
        if(this.state.send_popup){
            return(<div key="popup" class="full-screen-popup center">
            <div class="login-background">
                <p class="important big-text">Do you want to confirm {this.state.loaded_user != undefined? this.state.loaded_user.name+" "+this.state.loaded_user.surname:""} as maker?</p>
                <form id={"confirmUserForm"} action={'#'} method={"POST"} class="inline-block">
                    <p class="small-text">ADMIN LOGIN:</p><input type={"text"} name={"login"}></input>
                    <p class="small-text">ADMIN PASSWORD:</p><input type={"password"} name={"password"}></input>
                </form>
                <a onClick={(event)=>this.confirmUser()} class="button6 inline-block button-confirm-user" href="#">{"CONFIRM USER"}</a>
                <a onClick={(event)=>this.setState({send_popup: false, logon_failed: false, success_animation: false})} class="button6 inline-block button-close-panel" href="#">{"CLOSE PANEL"}</a>
                {this.state.logon_failed?<p class="big-text important">INCORRECT LOGIN</p>:[]}
            </div>
            </div>)
        }
        else{
            return(<div></div>);
        }

    }

    render()
    {
        let panel = this.panelDiv();
        let send_popup = this.managePopup();

        return(
            <div class="confirmation-panel-show-button-div">
                <a href="#" onClick={(event)=>this.setState({activated: !this.state.activated})} class="button6">
                {this.state.activated?"hide confirmation panel":"show confirmation panel"}
                </a>
                <ReactCSSTransitionGroup transitionName="simple" transitionEnterTimeout={1000} transitionLeaveTimeout={500}>
                {this.state.activated ? 
                    <div key={"panel"}>
                    {panel}
                    </div>:<div></div>
                }
                </ReactCSSTransitionGroup>
                <ReactCSSTransitionGroup transitionName={this.state.success_animation?"correct_logon":"simple"} transitionEnterTimeout={500} transitionLeaveTimeout={500}>
                {this.state.send_popup?send_popup:<div></div>}
                </ReactCSSTransitionGroup>
                
            </div>
        );
    }
}


function breakfastRequest(callback)
{
    let req = new XMLHttpRequest();
    req.open('GET', "http://127.0.0.1:5000/current_breakfast", true);
    req.onloadend = (event) => {
        if (req.readyState == 4 && req.status == 200)
        {
            callback(req.responseText);
        }
    }
    req.send();
}

function queueRequest(callback, which_one=0)
{
    let req = new XMLHttpRequest();
    req.open('GET', `http://127.0.0.1:5000/${which_one}_in_making_queue`, true);
    req.onloadend = (event) => {
        if(req.readyState == 4 && req.status == 200)
        {
            callback(req.responseText);
        }
    }
    req.send();
}

function confirmUserRequest(callback, login, password, which_one=0)
{
    let req = new XMLHttpRequest();
    req.open('POST', `http://127.0.0.1:5000/attach_person_from_queue_to_brakfast/${which_one}`, true);
    req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    req.onloadend = (event) => {
        if(req.readyState == 4 && req.status == 200){
            callback(req.responseText);
        }
    }
    let post_data = `login=${login}&password=${password}`;
    req.send(post_data);
}

ReactDOM.render(<App />, document.getElementById('root'));


