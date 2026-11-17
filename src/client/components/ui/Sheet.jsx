import React from 'react';
import Dialog from './Dialog';
import './Sheet.css';

/** Bottom sheet on phones (centred dialog on larger screens). */
export default function Sheet(props) {
  return <Dialog variant="sheet" {...props} className={`sheet ${props.className || ''}`.trim()} />;
}
