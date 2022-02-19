import { AddRoutes } from '../../interfaces/Interfaces'
import React, { useContext } from 'react';
import StateContext from '../../context/context';
import FormControl from '@material-ui/core/FormControl';
import MenuItem from '@material-ui/core/MenuItem';
import Select from '@material-ui/core/Select';
import { InputLabel } from '@material-ui/core';


function AddLink({ id }: AddRoutes) {
  const [state, dispatch] = useContext(StateContext);
  console.log('AddLink\'s state', state);
  const handleClick = (id) => {
    dispatch({
      type: 'ADD CHILD',
      payload: {
        type: 'HTML Element',
        typeId: 19,
        childId: id // this is the id of the parent to attach it to
      }
    });
  }

  const handlePageSelect = event => {
    const selectedPageName = event.target.value;
    console.log('selectedPages State: ', selectedPageName);
    // dispatch({ type: 'HREF TO', payload: });
  }

  console.log('state', state);
  let pagesItems = state.components.filter(comp => state.rootComponents.includes(comp.id));
  let dropDown = pagesItems.map(comp => <MenuItem value={comp.name}>{comp.name}</MenuItem>);
  return (
    <div style={{ padding: '1px', float: 'right' }}>
      <FormControl size='small'>
        <InputLabel>Pages</InputLabel>
        <Select variant="outlined"
          onChange={handlePageSelect}
          id="page-select"
        >
          {dropDown}
        </Select>
      </FormControl>
    </div>
  );
}

export default AddLink;
