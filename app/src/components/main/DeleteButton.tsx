import React from 'react';
import { DeleteButtons } from '../../interfaces/Interfaces';
import { useDispatch, useSelector } from 'react-redux';
import { deleteChild } from '../../redux/reducers/slice/appStateSlice';
import { RootState } from '../../redux/store';
import { emitEvent } from '../../helperFunctions/socket';

function DeleteButton({ id, name }: DeleteButtons) {
  const contextParam = useSelector((store: RootState) => store.contextSlice);

  const roomCode = useSelector((store: RootState) => store.roomSlice.roomCode);

  const dispatch = useDispatch();

  const deleteHTMLtype = (id: number) => {
    dispatch(deleteChild({ id: id, contextParam: contextParam }));
    if (roomCode) {
      emitEvent('deleteChildAction', roomCode, {
        id,
        contextParam
      });

      // console.log(
      //   'emit deleteChildAction event is triggered in DeleteButton.tsx'
      // );
    }
  };

  return (
    <div style={{ padding: '1px', float: 'right' }}>
      <button
        className="delete-button-empty"
        id={'btn' + id}
        onClick={(event) => {
          event.stopPropagation();
          deleteHTMLtype(id);
        }}
      >
        x
      </button>
    </div>
  );
}

export default DeleteButton;
