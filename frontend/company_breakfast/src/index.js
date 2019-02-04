import React from 'react';
import ReactDOM from 'react-dom';
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
            <div>
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
            <div>
                <div>{"Next breakfast date: "}</div>
                <div>{this.state.breakfastDate}</div>
                <div>{"Will make: "}</div>
                <div>{this.state.breakfastMaker}</div>
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
        this.state = {queue: [undefined, undefined, undefined, undefined, undefined, undefined]};
        this.updateQueue();
        let eventSingleton = new EventSingleton();
        eventSingleton.subscribeToEvent('BREAKFAST_CYCLIC_UPDATE', ()=>this.updateQueue);
    }

    render()
    {

        if(this.state.queue.every((value)=>value!==undefined))
        {
            let queue = [];
            this.state.queue.forEach(q => {
                queue.push(<div>{q.name}</div>);
            });
            return(
                <div>
                    {queue}
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
        this.state = {activated: false, loading_user: false, loaded_user: undefined, current_selection: 0, send_popup: false}
        this.reloadUser();

        let eventSingleton = new EventSingleton();
        eventSingleton.subscribeToEvent('LOGON_CORRECT', (data)=>{
            alert('LOGON CORRECT!');
            this.reloadUser();
        });
        eventSingleton.subscribeToEvent('LOGON_FAILED', (data)=>{alert('LOGON FAILED!')});
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
            if(this.state.current_selection > 0){
                ret_stack.push(<button onClick={(data)=>this.changeSelection(true)}>{"decrement"}</button>);
            } 
            
            if(this.state.loading_user || this.state.loaded_user == undefined)
            {
                ret_stack.push(<div>{"loading_user"}</div>)
            }else if(this.state.loaded_user != undefined){
                ret_stack.push(<div>{this.state.loaded_user.name+" "+this.state.loaded_user.surname+" "+this.state.loaded_user.queue_count}</div>)
            }

            ret_stack.push(<button onClick={(data)=>this.changeSelection()}>{"increment"}</button>)
            ret_stack.push(<button onClick={(event)=>this.setState({send_popup: true})}>
                                           {"SEND CONFIRMATION"}
                                            </button>);
        }
        else{
            ret_stack.push(<div></div>);
        }
        return(ret_stack);
    }

    managePopup()
    {
        if(this.state.send_popup){
            return(<div>
                <form id={"confirmUserForm"} action={`http://127.0.0.1:5000/attach_person_from_queue_to_brakfast/${this.state.current_selection}`} method={"POST"}>
                    <input type={"text"} name={"login"}></input>
                    <input type={"password"} name={"password"}></input>
                </form>
                <button onClick={(event)=>this.confirmUser()}>{"CONFIRM USER"}</button>
                <button onClick={(event)=>this.setState({send_popup: false})}>{"CLOSE PANEL"}</button>
            </div>)
        }
        else{
            return(<div></div>)
        }

    }

    render()
    {
        let panel = this.panelDiv();
        let send_popup = this.managePopup();

        return(
            <div>
                <button onClick={(event)=>this.setState({activated: !this.state.activated})}>{this.state.activated?"hide confirmation panel":"show confirmation panel"}</button>
                {panel}
                {this.state.send_popup?send_popup:<div></div>}
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


