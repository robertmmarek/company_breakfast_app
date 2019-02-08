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
            this.EVENTS = {BREAKFAST_CYCLIC_UPDATE: undefined, LOGON_FAILED: undefined, LOGON_CORRECT: undefined, FAILED_ACTION_AUTH: undefined};
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
        this.state = {showLoginPopup: false, showLoginFailed: false, showSuccessfulLogin: false, showAdminPanel: false};

        let eventSingleton = new EventSingleton();
        eventSingleton.subscribeToEvent('FAILED_ACTION_AUTH', (data)=>this.setState({showLoginPopup: true, showAdminPanel: false}));
    }

    tryShowAdminPanel()
    {
        checkIfLoggedRequest((isLogged)=>{
            console.log(isLogged);
            if(isLogged)
            {
                this.setState({showAdminPanel: !this.state.showAdminPanel});
            }
            else{
                this.setState({showAdminPanel: false});
                let eventSingleton = new EventSingleton();
                eventSingleton.triggerEvent('FAILED_ACTION_AUTH');
            }
        });
    }

    render()
    {
        return(
           
            <div class="main-div">
                <CurrentBreakfast />
                <UserQueue />

                <div class="admin-panel-show-button-div">
                    <span href="#" onClick={(event)=>this.tryShowAdminPanel()} class="button6">
                    {this.state.showAdminPanel?"hide admin panel":"show admin panel"}
                    </span>
                </div>

                <ReactCSSTransitionGroup transitionName="simple" transitionEnterTimeout={500} transitionLeaveTimeout={500}>
                {this.state.showAdminPanel?
                <AdminPanel />
                :[]
                }
                </ReactCSSTransitionGroup>

                <ReactCSSTransitionGroup transitionName={this.state.showSuccessfulLogin?"correct_logon":"simple"} transitionEnterTimeout={500} transitionLeaveTimeout={500}>
                {this.state.showLoginPopup?
                <LoginPopup 
                onLogin={(event)=>this.tryLogin()} 
                onLoginClose={(event)=>this.setState({showLoginPopup: false, showLoginFailed: false, showSuccessfulLogin: false})}
                logonFailed={this.state.showLoginFailed}
                />
                :[]
                }
                </ReactCSSTransitionGroup>
            </div>
        );
    }

    tryLogin()
    {
        let login_form = document.getElementById('login-form');
        let login = login_form.login.value;
        let password = login_form.password.value;
        loginRequest((isSuccess)=>{
            if(isSuccess)
            {
                this.setState({showLoginFailed: false, showSuccessfulLogin: true, showLoginPopup: false});
            }else{
                this.setState({showLoginFailed: true, showSuccessfulLogin: false});
            }
        }, login, password)
    }
}


class CurrentBreakfast extends React.Component
{
    updateBreakfastState(json)
    {
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
        breakfastRequest((json)=>this.updateBreakfastState(json));
        setInterval(()=>(breakfastRequest((json)=>this.updateBreakfastState(json))), 500);
    }

    render()
    {
        return(
            <div class={"next-breakfast-div"}>
                <ReactCSSTransitionGroup transitionName="simple" transitionEnterTimeout={500} transitionLeaveTimeout={300}>
                <p class={"big-text small-bottom-margin"}>{"Next breakfast date: "}</p>
                {this.state.breakfastDate != ''?
                <p class={"very-big-text important no-margin-top"} key="date">{this.state.breakfastDate}</p>
                :<p></p>
                }
                <p class={"big-text small-bottom-margin"}>{"Will make: "}</p>
                {this.state.breakfastMaker != ''?
                <p class={"very-big-text important no-margin-top"} key="user">{this.state.breakfastMaker}</p>
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
         queueRequest((json)=>{
            let temp_state = this.state;

            for(let i=0; i<json.queue.length; i++)
            {
                temp_state.queue[i] = {name: json.queue[i].name+" "+json.queue[i].surname, done_already: json.queue[i].queue_count};
            }
            this.setState(temp_state);
        }
        ,this.state.queue.length);
        
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
        confirmUserRequest((json)=>{
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
        queueRequest((json)=>{
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
                    <ReactCSSTransitionGroup transitionName="simple" transitionEnterTimeout={1000} transitionLeaveTimeout={500}>
                        {(this.state.current_selection > 0) ? 
                            <span key="decrement-button" href="#" onClick={(data)=>this.changeSelection(true)} class="left-user-selection-button button6">{"<<"}</span>
                            :<div class="left-user-selection-button"></div>
                        }
                    </ReactCSSTransitionGroup>
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
                        <span key="increment-button" href="#" onClick={(data)=>this.changeSelection()} class="right-user-selection-button button6">{">>"}</span>
                    </td>
                </tr>
            </table>
            </div>
                    <span key="send-confirmation-button" href="#" onClick={(event)=>this.setState({send_popup: true, success_animation: false})} class="new-line button6">
                        {"SEND CONFIRMATION"}
                    </span>
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
                <div class="upper-bar-div">
                    <span onClick={(event)=>this.setState({send_popup: false, logon_failed: false, success_animation: false})} class="button6 inline-block button-close-panel" href="#">{"close"}</span>
                </div>
                <p class="important very-big-text">Do you want to confirm <br/>{this.state.loaded_user != undefined? this.state.loaded_user.name+" "+this.state.loaded_user.surname:""}<br/> as maker?</p>
                <form id={"confirmUserForm"} action={'#'} method={"POST"} class="inline-block">
                    <p class="small-text small-bottom-margin">ADMIN LOGIN:</p><input type={"text"} name={"login"}></input>
                    <p class="small-text small-bottom-margin">ADMIN PASSWORD:</p><input type={"password"} name={"password"}></input>
                </form>
                <span onClick={(event)=>this.confirmUser()} class="button6 inline-block button-confirm-user" href="#">{"CONFIRM USER"}</span>
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
                <span href="#" onClick={(event)=>this.setState({activated: !this.state.activated})} class="button6">
                {this.state.activated?"hide confirmation panel":"show confirmation panel"}
                </span>
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

class AdminPanel extends React.Component
{
    constructor(props)
    {
        super(props);
    }


    render()
    {
        return(
            <div key="admin-panel">
                <div class="admin-panel-div">
                    DIV
                </div>
            </div>
        );
    }
}


/*
*/
class LoginPopup extends React.Component
{
    constructor(props)
    {
        super(props);
        this.state = {}
    }

    render()
    {
        return(
        <div class="full-screen-popup" key={"full-screen-popup"}>
            <div class="login-background">
                <div class="upper-bar-div">
                    <span onClick={this.props.onLoginClose} class="button6 inline-block button-close-panel" href="#">{"close"}</span>
                </div>
                <form id={"login-form"} method="POST" action="#">
                    <p class="small-text small-bottom-margin">ADMIN LOGIN:</p><input type={"text"} name={"login"}></input>
                    <p class="small-text small-bottom-margin">ADMIN PASSWORD:</p><input type={"password"} name={"password"}></input>
                    <span onClick={this.props.onLogin} class="button6 inline-block button-confirm-user" href="#">{"LOGIN"}</span>
                    {this.props.logonFailed?<p class="big-text important">INCORRECT LOGIN</p>:[]}
                </form>
            </div>
        </div>);
    }
}


function breakfastRequest(callback)
{
    let url = "http://localhost:5000/current_breakfast";
    sendGETRequestAndReturnJSON(url, callback);
}

function queueRequest(callback, how_many=0)
{
    let url = `http://localhost:5000/get_first_${how_many}_in_making_queue`;
    sendGETRequestAndReturnJSON(url, callback);
}

function checkIfLoggedRequest(callback)
{
    let url = 'http://localhost:5000/is_admin_logged';
    sendGETRequestAndReturnJSON(url, callback, (json)=>('correct_logon' in json)?json['correct_logon']:false);
}

function loginRequest(callback, login, password)
{
    let url = 'http://localhost:5000/admin_login';
    sendPOSTRequestAndReturnJSON(url, {login: login, password: password}, callback, (json)=>('correct_logon' in json)?json['correct_logon']:false);
}

function addUserRequest(callback, name, surname, how_many_breakfast_made=0)
{
    let url = 'http://localhost:5000/add_user';
    sendPOSTRequestAndReturnJSON(url, {name: name, 
        surname: surname, 
        breakfasts_done: how_many_breakfast_made}, 
        callback, 
        (json)=>('success' in json)?json['success']:false);
}

function logoutRequest(callback)
{
    let url = 'http://localhost:5000/admin_logout';
    sendPOSTRequestAndReturnJSON(url, {}, callback, (json)=>('correct_logon' in json)?json['correct_logon']:false);
}

function confirmUserRequest(callback, login, password, which_one=0)
{
    let url = `http://localhost:5000/attach_person_from_queue_to_brakfast/${which_one}`;
    sendPOSTRequestAndReturnJSON(url, {login: login, password: password}, callback);
}

function sendPOSTRequestAndReturnJSON(request_url, post_data, callback, json_processing=(json)=>json)
{
    let req = new XMLHttpRequest();
    req.open('POST', request_url, true)
    req.withCredentials = true;
    req.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    req.onloadend = (event) => {
        if(req.readyState == 4 && req.status == 200)
        {
            let json = JSON.parse(req.responseText);
            callback(json_processing(json));
        }
    }
    let post_data_string = '';
    let keys = Object.keys(post_data)
    keys.forEach((key, index)=>{
        post_data_string += `${key}=${post_data[key]}` +  String((index != (keys.length-1))?"&":"");
    })
    req.send(post_data_string);
}

function sendGETRequestAndReturnJSON(request_url, callback, json_processing=(json)=>json)
{
    let req = new XMLHttpRequest();
    req.withCredentials = true;
    req.open('GET', request_url, true)
    req.onloadend = (event) => {
        if(req.readyState == 4 && req.status == 200)
        {
            let json = JSON.parse(req.responseText);
            callback(json_processing(json));
        }
    }
    req.send();
}

ReactDOM.render(<App />, document.getElementById('root'));


