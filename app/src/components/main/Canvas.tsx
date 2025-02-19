import { Component, DragItem } from '../../interfaces/Interfaces';
import { DropTargetMonitor, useDrop } from 'react-dnd';
import React, { useEffect, useState } from 'react';
import {
  addChild,
  changeFocus,
  snapShotAction
} from '../../redux/reducers/slice/appStateSlice';
import { useDispatch, useSelector } from 'react-redux';
import { debounce, throttle } from 'lodash';

import Arrow from './Arrow';
import { ItemTypes } from '../../constants/ItemTypes';
import { RootState } from '../../redux/store';
import { combineStyles } from '../../helperFunctions/combineStyles';
import renderChildren from '../../helperFunctions/renderChildren';
import { emitEvent, getSocket } from '../../helperFunctions/socket';
import { FaMousePointer } from 'react-icons/fa';
import { Console } from 'console';

function Canvas(props: {}): JSX.Element {
  const state = useSelector((store: RootState) => store.appState);
  const contextParam = useSelector((store: RootState) => store.contextSlice);
  const roomCode = useSelector((store: RootState) => store.roomSlice.roomCode);
  const userName = useSelector((store: RootState) => store.roomSlice.userName);
  const userList = useSelector((store: RootState) => store.roomSlice.userList);

  //-------cursors tracking-------

  //remote cursor data
  const [remoteCursors, setRemoteCursors] = useState([]);

  // Toggle switch for live cursor tracking
  const [toggleSwitch, setToggleSwitch] = useState(true);

  // Toggle button text for live cursor tracking button - on/off
  const [toggleText, setToggleText] = useState('off');
  const toggleButton = () => {
    setToggleText(toggleText === 'on' ? 'off' : 'on');
  };

  // Prevents lagging and provides smoother user experience got live cursor tracking (milliseconds can be adjusted but 500ms is most optimal)
  const debounceSetPosition = debounce((newX, newY) => {
    //emit socket event every 300ms when cursor moves
    if (userList.length > 1)
      emitEvent('cursorData', roomCode, { x: newX, y: newY, userName });
  }, 500);

  const handleMouseMove = (e) => {
    debounceSetPosition(e.clientX, e.clientY);
  };

  const handleCursorDataFromServer = (remoteData) => {
    setRemoteCursors((prevState) => {
      //check if received cursor data is from an existing user in the room
      const cursorIdx = prevState.findIndex(
        (cursor) => cursor.remoteUserName === remoteData.userName
      );
      //existing user
      if (cursorIdx >= 0) {
        //check if cursor position has changed
        if (
          prevState[cursorIdx].x !== remoteData.x ||
          prevState[cursorIdx].y !== remoteData.y
        ) {
          //update existing user's cursor position
          const updatedCursors = [...prevState];
          updatedCursors[cursorIdx] = {
            ...prevState[cursorIdx],
            x: remoteData.x,
            y: remoteData.y
          };
          return updatedCursors;
        } else {
          //return previous state if no change
          return prevState;
        }
      } else {
        //new user: add new user's cursor
        return [
          ...prevState,
          {
            x: remoteData.x,
            y: remoteData.y,
            remoteUserName: remoteData.userName,
            isVisible: true
          }
        ];
      }
    });
  };

  // console.log('userList:', userList);
  //[{x,y,remoteUserName, isVisible}, {...}, {...}];
  // console.log('remoteCursors:', remoteCursors);

  // Removes the mouse cursor of the user that leaves the collaboration room.
  const handleCursorDeleteFromServer = () => {
    setRemoteCursors((prevRemoteCursors) =>
      prevRemoteCursors.map((cursor) => ({
        ...cursor,
        isVisible: userList.includes(cursor.remoteUserName)
      }))
    );
  };

  // Function that will turn on/off socket depending on toggle Switch.
  const handleToggleSwitch = () => {
    setToggleSwitch(!toggleSwitch);
    //checks the state before it's updated so need to check the opposite condition
    if (toggleSwitch) {
      //turn off
      socket.off('remote cursor data from server');
      //make remote cursor invisible
      setRemoteCursors((prevState) => {
        const newState = prevState.map((cursor) => ({
          ...cursor,
          isVisible: false
        }));
        return newState;
      });
    } else {
      //turn on
      socket.on('remote cursor data from server', (remoteData) =>
        handleCursorDataFromServer(remoteData)
      );
      //make remote cursor visible
      setRemoteCursors((prevState) =>
        prevState.map((cursor) => ({
          ...cursor,
          isVisible: true
        }))
      );
    }
  };

  //Function to handle the multiple click events of the toggle button.
  const multipleClicks = () => {
    handleToggleSwitch();
    toggleButton();
  };

  const socket = getSocket();
  //wrap the socket event listener in useEffect with dependency array as [socket], so the the effect will run only when: 1. After the initial rendering of the component 2. Every time the socket instance changes(connect, disconnect)
  useEffect(() => {
    // console.log(
    //   'socket inside useEffect:',
    //   socket ? 'connected' : 'not connected'
    // );

    if (socket) {
      // console.log('------setting up socket.on event listener-------');
      socket.on('remote cursor data from server', (remoteData) =>
        handleCursorDataFromServer(remoteData)
      );
    }

    return () => {
      // console.log('clean up cursor event listener after canvas unmount');
      if (socket) socket.off('remote cursor data from server');
    };
  }, [socket]);

  useEffect(() => {
    handleCursorDeleteFromServer();
    // console.log('handle delete has been called');
  }, [userList]);

  //-----------------

  // find the current component based on the canvasFocus component ID in the state
  const currentComponent: Component = state.components.find(
    (elem: Component) => elem.id === state.canvasFocus.componentId
  );
  // console.log(' state.components:', state.components);
  // console.log('canvasFocus.componentId: ', state.canvasFocus.componentId);

  Arrow.deleteLines();

  const dispatch = useDispatch();
  // changes focus of the canvas to a new component / child
  const changeFocusFunction = (
    componentId?: number,
    childId?: number | null
  ) => {
    dispatch(changeFocus({ componentId, childId }));
    //if room exists, send focus dispatch to all users
    if (roomCode) {
      emitEvent('changeFocusAction', roomCode, {
        componentId: componentId,
        childId: childId
      });
    }
  };

  // onClickHandler is responsible for changing the focused component and child component
  function onClickHandler(event: React.MouseEvent) {
    event.stopPropagation();
    changeFocusFunction(state.canvasFocus.componentId, null);
  }

  // stores a snapshot of state into the past array for UNDO. snapShotFunc is also invoked for nestable elements in DirectChildHTMLNestable.tsx
  const snapShotFunc = () => {
    // make a deep clone of state
    const deepCopiedState = JSON.parse(JSON.stringify(state));
    const focusIndex = state.canvasFocus.componentId - 1;
    dispatch(
      snapShotAction({
        focusIndex: focusIndex,
        deepCopiedState: deepCopiedState
      })
    );
  };

  // This hook will allow the user to drag items from the left panel on to the canvas
  const [{ isOver }, drop] = useDrop({
    accept: ItemTypes.INSTANCE,
    drop: (item: DragItem, monitor: DropTargetMonitor) => {
      const didDrop = monitor.didDrop();
      // takes a snapshot of state to be used in UNDO and REDO cases
      snapShotFunc();
      // returns false for direct drop target
      if (didDrop) {
        return;
      }
      // if item dropped is going to be a new instance (i.e. it came from the left panel), then create a new child component
      if (item.newInstance && item.instanceType !== 'Component') {
        dispatch(
          //update state
          addChild({
            type: item.instanceType,
            typeId: item.instanceTypeId,
            childId: null,
            contextParam: contextParam
          })
        );

        //emit the socket event
        if (roomCode) {
          emitEvent('addChildAction', roomCode, {
            type: item.instanceType,
            typeId: item.instanceTypeId,
            childId: null,
            contextParam: contextParam
          });

          // console.log(
          //   `emit addChildAction event is triggered in canvas from ${socket.id}`
          // );
        }
      } else if (item.newInstance && item.instanceType === 'Component') {
        let hasDiffParent = false;
        const components = state.components;
        let newChildName = '';
        // loop over components array
        for (let i = 0; i < components.length; i++) {
          const comp = components[i];
          //loop over each componenets child
          for (let j = 0; j < comp.children.length; j++) {
            const child = comp.children[j];
            if (child.name === 'separator') continue;
            // check if the item.instanceTypeId matches and child ID
            if (item.instanceTypeId === child.typeId) {
              // check if the name of the parent matches the canvas focus name
              // comp is the parent component
              // currentComponent is the canvas.focus component
              if (comp.name === currentComponent.name) {
                i = components.length;
                break;
              } else {
                // if false
                // setCopiedComp(child);
                hasDiffParent = true;
                newChildName = child.name;
                i = components.length;
                break;
              }
            }
          }
        }
        // if (!hasDiffParent) {
        dispatch(
          addChild({
            type: item.instanceType,
            typeId: item.instanceTypeId,
            childId: null,
            contextParam: contextParam
          })
        );
        if (roomCode) {
          emitEvent('addChildAction', roomCode, {
            type: item.instanceType,
            typeId: item.instanceTypeId,
            childId: null,
            contextParam: contextParam
          });

          // console.log('emit addChildAction event is triggered in canvas');
        }
      }
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver()
    })
  });

  // Styling for Canvas
  const defaultCanvasStyle: React.CSSProperties = {
    width: '100%',
    minHeight: '100%',
    backgroundColor: isOver ? '#242323' : '#191919',
    // borderStyle: isOver ? 'dotted' : 'solid',
    aspectRatio: 'auto 774 / 1200',
    boxSizing: 'border-box'
  };

  // Combine the default styles of the canvas with the custom styles set by the user for that component
  // The renderChildren function renders all direct children of a given component
  // Direct children are draggable/clickable

  const canvasStyle: React.CSSProperties = combineStyles(
    defaultCanvasStyle,
    currentComponent.style
  );

  // Array of colors that color code users as they join the room (In a set order)
  const userColors = [
    '#FC00BD',
    '#D0FC00',
    '#00DBFC',
    '#FD98B8',
    '#FCAA00',
    '#9267FF'
  ];

  return (
    <div
      className={'componentContainer'}
      ref={drop}
      data-testid="drop"
      style={canvasStyle}
      onClick={onClickHandler}
      onMouseMove={handleMouseMove}
    >
      {renderChildren(currentComponent.children)}

      {remoteCursors.map(
        (cursor, idx) =>
          cursor.isVisible && (
            <div
              key={idx}
              className="remote-cursor"
              style={{
                position: 'absolute',
                left: cursor.x + 'px',
                top: cursor.y - 68 + 'px',
                //cursor style
                fontSize: '1em',
                color: userColors[userList.indexOf(cursor.remoteUserName)]
              }}
            >
              {<FaMousePointer />}
              {cursor.remoteUserName}
            </div>
          )
      )}
      <label className="switch">
        {userList.length > 1 && (
          <button
            className="btn-toggle"
            onClick={multipleClicks}
            style={{
              position: 'fixed',
              width: 'max-content',
              height: 'max-content',
              bottom: '100px',
              left: '51vw',
              textAlign: 'center',
              color: '#FFFFFF',
              backgroundColor: '#151515',
              zIndex: 0,
              padding: '5px',
              borderColor: '#46C0A5',
              borderRadius: '5px'
            }}
          >
            {toggleText === 'on' ? 'View Cursors' : 'Hide Cursors'}
          </button>
        )}
      </label>
    </div>
  );
}

export default Canvas;
