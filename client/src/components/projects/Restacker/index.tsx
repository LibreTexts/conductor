import { useQuery } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom';
import { Button, Grid, Header, Loader } from 'semantic-ui-react'
import { RestackerData } from './model';
import api from '../../../api';

const Restacker: React.FC = () => {
    const { id: projectID } = useParams<{ id: string }>();


    const [states, setStates] = useState<RestackerData | null>(null);

    // load the project details
    useEffect(() => {
        const loadProject = async () => {
                const res = await api.getRemixerProject(projectID);
                setStates(res.project);
           
        }
        loadProject();
    }, [projectID]);
    // load the book details
    
    // calculate the restack for each page and license details
    // display the restack for each page


  return (
    <Grid
    className="component-container"
    style={{
      justifyContent: "center",
      paddingTop: 72,
      width: "100%",
      marginLeft: 0,
      marginRight: 0,
    }}
  >
           {!states && (<Loader active inline='centered' />)}
    <Grid.Row>
        <Grid.Column width={16}>
            <Header as='h1'>Restacker</Header>
           {states && (
            <div>
               {JSON.stringify(states)}
            </div>
           )}
        </Grid.Column>
    </Grid.Row>
    </Grid>
  )
}

export default Restacker