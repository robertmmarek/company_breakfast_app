import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';



class App extends React.Component
{
    constructor(props)
    {
        super(props);
    }

    render()
    {
        return(
            <div>
                <CurrentBreakfast />
                <UserQueue />
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
    }

    constructor(props)
    {
        super(props);
        this.state = {breakfastDate: '', breakfastMaker: ''};
        breakfastRequest((text)=>this.updateBreakfastState(text));
        setInterval(()=>(breakfastRequest((text)=>this.updateBreakfastState(text))), 100);
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
                
            }
            ,i);
        }
    }

    constructor(props)
    {
        super(props);
        this.state = {queue: [undefined, undefined, undefined, undefined, undefined, undefined]};
    }

    render()
    {
        return(
            <div>
                {"UserQueue"}
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
    req.open('GET', `http://127.0.0.1:5000//${which_one}_in_making_queue`, true);
    req.onloadend = (event) => {
        if(req.readyState == 4 && req.status == 200)
        {
            callback(req.responseText);
        }
    }
    req.send();
}

ReactDOM.render(<App />, document.getElementById('root'));


