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
                temp_state.queue[i] = json.queue[i]!=null?{name: json.queue[i].name+" "+json.queue[i].surname, done_already: json.queue[i].queue_count}:{name:'', done_already:0};
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

class AdminPanel extends React.Component
{
    constructor(props)
    {
        super(props);
        this.state = {popupsVisibility:{confirmUser: false, addUser: false, removeUser: false}, showSuccess: false};

        let eventSingleton = new EventSingleton();
        eventSingleton.subscribeToEvent('FAILED_ACTION_AUTH', (data)=>{
            this.hideAllPopups();
        });
    }

    setPopupVisibility(which, value, success=false)
    {
        let popups = this.state.popupsVisibility;
        popups[which] = value;
        this.setState({popupsVisibility: popups, showSuccess: success});
    }

    hideAllPopups(success=false)
    {
        let popups = this.state.popupsVisibility;
        Object.keys(popups).forEach((key, index)=>popups[key]=false);
        this.setState({popupsVisibility: popups, showSuccess: success});
    }

    tryToShowPopup(which)
    {
        authorizedRequest((data)=>this.setPopupVisibility(which, true));
    }

    render()
    {
        return(
            <div key="admin-panel">
                <div class="admin-panel-div">           
                    <span onClick={(event)=>this.tryToShowPopup('confirmUser')} class="button6 inline-block small-bottom-margin" href="#">{"SELECT BREAKFAST MAKER"}</span>
                    <span onClick={(event)=>this.tryToShowPopup('addUser')} class="button6 inline-block small-bottom-margin" href="#">{"ADD USER"}</span>
                    <span onClick={(event)=>this.tryToShowPopup('removeUser')} class="button6 inline-block small-bottom-margin" href="#">{"REMOVE USER"}</span>
                </div>
                <ReactCSSTransitionGroup transitionName={this.state.showSuccess?"correct_logon":"simple"} transitionEnterTimeout={500} transitionLeaveTimeout={300}>
                    {this.state.popupsVisibility.confirmUser?
                    <ConfirmUserPopup onSuccess={(data)=>this.hideAllPopups(true)} onPopupClose={(data)=>this.hideAllPopups()} />
                    :[]}
                    {this.state.popupsVisibility.addUser?
                    <AddUserPopup onSuccess={(data)=>this.hideAllPopups(true)} onPopupClose={(data)=>this.hideAllPopups()} />
                    :[]}
                    {this.state.popupsVisibility.removeUser?
                    <RemoveUserPopup onSuccess={(data)=>this.hideAllPopups(true)} onPopupClose={(data)=>this.hideAllPopups()} />
                    :[]}
                </ReactCSSTransitionGroup>
            </div>
        );
    }
}

class AddUserPopup extends React.Component
{
    constructor(props)
    {
        super(props);
        this.state = {actionFailed: false, breakfastAmount: 0}
        let eventSingleton = new EventSingleton();
        eventSingleton.subscribeToEvent('FAILED_ACTION_AUTH', (data)=>{
            this.setState({actionFailed: true});
        });
    }

    incrementBreakfast(reverse=false)
    {
        let prev = this.state.breakfastAmount;
        let increment = reverse?-1:1;
        this.setState({breakfastAmount: Math.max(0, prev+increment)});
    }

    tryAddUser()
    {
        let user_create_form = document.getElementById('user-create-form');
        let name = user_create_form.name.value;
        let surname = user_create_form.surname.value;
        let breakfasts = this.state.breakfastAmount;
        authorizedRequest((data)=>{
            addUserRequest((correct)=>
            {
                if(correct)
                {
                    this.props.onSuccess();
                }else{
                    this.setState({actionFailed: true});
                }
            },
            name,
            surname,
            breakfasts);
        },
        (data)=>{
            this.setState({actionFailed: true});
        });
    }

    render()
    {
        return(
            <div class="full-screen-popup" key={"full-screen-popup"}>
                <div class="login-background">
                    <div class="upper-bar-div">
                        <span onClick={this.props.onPopupClose} class="button6 inline-block button-close-panel" href="#">{"close"}</span>
                    </div>
                    <form id={"user-create-form"} method="POST" action="#">
                        <p class="small-text small-bottom-margin">USER NAME:</p><input type={"text"} name={"name"}></input>
                        <p class="small-text small-bottom-margin">USER SURNAME:</p><input type={"text"} name={"surname"}></input>
                        <p class="small-text small-bottom-margin">BREAKFASTS DONE:</p>
                        <table class="user-navigation">
                            <tr>
                                <td class="left">
                                    {this.state.breakfastAmount > 0?
                                    <span onClick={()=>this.incrementBreakfast(true)} class="button6 inline-block left-user-selection-button" href="#">{"<<"}</span>
                                    :[]}
                                </td>
                                <td class="middle">
                                    <p class="important big-text">{this.state.breakfastAmount}</p>
                                </td>
                                <td class="right">
                                <span onClick={()=>this.incrementBreakfast()} class="button6 inline-block right-user-selection-button" href="#">{">>"}</span>
                                </td>
                            </tr>
                        </table>
                        <span onClick={(event)=>this.tryAddUser()} class="button6 inline-block button-confirm-user" href="#">{"ADD"}</span>
                        {this.actionFailed?<p class="big-text important">FAILED</p>:[]}
                    </form>
                </div>
            </div>
            );
    }
}

class ConfirmUserPopup extends React.Component
{
    constructor(props)
    {
        super(props);
        this.state = {currentSelection: 0, isLoading: true, loadedUser: undefined}
        this.incrementSelection(true);
    }

    incrementSelection(reverse=false)
    {
        authorizedRequest((data)=>{
            let increment = reverse?-1:1;
            let newSelection = Math.max(this.state.currentSelection+increment, 0);
            this.selectUser(newSelection);
        });
    }

    selectUser(which_one)
    {
        which_one = Math.max(0, which_one);
        this.setState({currentSelection: which_one, isLoading: true})
        getQueueUser((json)=>{
            this.setState({isLoading: false, loadedUser: json});
        } ,which_one);
    }

    confirmUser(){
        authorizedRequest((data)=>{
            confirmUserRequest((json)=>{
                if(json.success)
                {
                    this.props.onSuccess();
                }
            }, this.state.currentSelection);
        }
        );
    }

    render()
    {
        return(
        <div class="full-screen-popup" key={"confirm-user-full-screen-popup"}>
            <div class="login-background">
                <div class="upper-bar-div">
                    <span onClick={this.props.onPopupClose} class="button6 inline-block button-close-panel" href="#">{"close"}</span>
                </div>
                <table class="user-navigation">
                    <tr>
                        <td class="left">
                            {this.state.currentSelection > 0?
                            <span onClick={()=>this.incrementSelection(true)} class="button6 inline-block left-user-selection-button" href="#">{"<<"}</span>
                            :[]}
                        </td>
                        <td class="middle">
                            <table class="user-preview">
                                <tr>
                                    <td>
                                        {this.state.isLoading?
                                        <p class="medium-text">LOADING</p>
                                        :<p class="medium-text">{this.state.loadedUser.name}</p>}
                                    </td>
                                    <td>
                                    {this.state.isLoading?
                                        <p class="medium-text">LOADING</p>
                                        :<p class="medium-text">{this.state.loadedUser.surname}</p>}
                                    </td>
                                </tr>
                            </table>
                        </td>
                        <td class="right">
                        <span onClick={()=>this.incrementSelection()} class="button6 inline-block right-user-selection-button" href="#">{">>"}</span>
                        </td>
                    </tr>
                </table>
                <span onClick={()=>this.confirmUser()} class="button6 inline-block button-confirm-user" href="#">{"CONFIRM USER"}</span>
            </div>
        </div>);
    }
}


class RemoveUserPopup extends React.Component
{
    constructor(props)
    {
        super(props);
        this.state = {currentSelection: 0, isLoading: true, loadedUser: undefined}
        this.incrementSelection(true);
    }

    incrementSelection(reverse=false)
    {
        authorizedRequest((data)=>{
            let increment = reverse?-1:1;
            let newSelection = Math.max(this.state.currentSelection+increment, 0);
            this.selectUser(newSelection);
        });
    }

    selectUser(which_one)
    {
        which_one = Math.max(0, which_one);
        this.setState({currentSelection: which_one, isLoading: true})
        getQueueUser((json)=>{
            this.setState({isLoading: false, loadedUser: json});
        } ,which_one);
    }

    removeUser(){
        authorizedRequest((data)=>{
            removeUserRequest((success)=>{
                if(success)
                {
                    this.props.onSuccess();
                }
            }, this.state.loadedUser);
        }
        );
    }

    render()
    {
        return(
        <div class="full-screen-popup" key={"confirm-user-full-screen-popup"}>
            <div class="login-background">
                <div class="upper-bar-div">
                    <span onClick={this.props.onPopupClose} class="button6 inline-block button-close-panel" href="#">{"close"}</span>
                </div>
                <table class="user-navigation">
                    <tr>
                        <td class="left">
                            {this.state.currentSelection > 0?
                            <span onClick={()=>this.incrementSelection(true)} class="button6 inline-block left-user-selection-button" href="#">{"<<"}</span>
                            :[]}
                        </td>
                        <td class="middle">
                            <table class="user-preview">
                                <tr>
                                    <td>
                                        {this.state.isLoading?
                                        <p class="medium-text">LOADING</p>
                                        :<p class="medium-text">{this.state.loadedUser.name}</p>}
                                    </td>
                                    <td>
                                    {this.state.isLoading?
                                        <p class="medium-text">LOADING</p>
                                        :<p class="medium-text">{this.state.loadedUser.surname}</p>}
                                    </td>
                                </tr>
                            </table>
                        </td>
                        <td class="right">
                        <span onClick={()=>this.incrementSelection()} class="button6 inline-block right-user-selection-button" href="#">{">>"}</span>
                        </td>
                    </tr>
                </table>
                <span onClick={()=>this.removeUser()} class="button6 inline-block button-confirm-user" href="#">{"REMOVE USER"}</span>
            </div>
        </div>);
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

function authorizedRequest(success_callback, failure_callback=(isLogged)=>isLogged)
{
    checkIfLoggedRequest((isLogged)=>{
        if(isLogged)
        {
            success_callback(isLogged);
        }else{
            let eventSingleton = new EventSingleton();
            eventSingleton.triggerEvent('FAILED_ACTION_AUTH');
            failure_callback(isLogged);
        }
    })
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

function getQueueUser(callback, which_one=0)
{
    let url = `http://localhost:5000/${which_one}_in_making_queue`;
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
    sendGETRequestAndReturnJSON(url, 
        callback, 
        (json)=>('success' in json)?json['success']:false,
        {name: name, 
         surname: surname, 
         breakfasts_done: how_many_breakfast_made});
}

function removeUserRequest(callback, user)
{
    let url = 'http://localhost:5000/delete_user';
    sendGETRequestAndReturnJSON(url, callback, (json)=>('success' in json)?json['success']:false, {hash: user.hash});
}

function logoutRequest(callback)
{
    let url = 'http://localhost:5000/admin_logout';
    sendPOSTRequestAndReturnJSON(url, {}, callback, (json)=>('correct_logon' in json)?json['correct_logon']:false);
}

function confirmUserRequest(callback, which_one=0)
{
    let url = `http://localhost:5000/attach_person_from_queue_to_brakfast/${which_one}`;
    sendGETRequestAndReturnJSON(url, callback);
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

function sendGETRequestAndReturnJSON(request_url, callback, json_processing=(json)=>json, post_data={})
{
    let req = new XMLHttpRequest();
    req.withCredentials = true;

    let post_data_string = '';
    let keys = Object.keys(post_data)
    keys.forEach((key, index)=>{
        post_data_string += `${key}=${post_data[key]}` +  String((index != (keys.length-1))?"&":"");
    })

    req.open('GET', request_url+(post_data_string.length>0?"?"+post_data_string:''), true)
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


