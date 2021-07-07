import { Grid, Header, Menu, Image, Segment, Divider, Message, Form, Button } from 'semantic-ui-react';
import React, { Component } from 'react';
import axios from 'axios';

import { UserContext } from '../../providers.js';

class AccountSettings extends Component {

    static contextType = UserContext;

    constructor(props) {
        super(props);
        this.state = {
            activeItem: 'overview',
            accountData: {
                email: '',
                firstName: '',
                lastName: '',
                roles: '',
                accountCreation: ''
            },
            avatar: '/steve.jpg'
        };
    }

    componentDidMount() {
        document.title = 'LibreTexts PTS | Account Settings';
        if (this.state.accountData.email === '') {
            this.getAccountInfo();
        }
    }

    handleClick(e, data) {
        this.setState({ activeItem: data.name });
    }

    getAccountInfo() {
        axios.get('/user/accountinfo').then((res) => {
            if (!res.data.err) {
                if (res.data.account != null) {
                    const createdDate = new Date(res.data.account.createdAt);
                    this.setState({
                        accountData: {
                            email: res.data.account.email,
                            firstName: res.data.account.firstName,
                            lastName: res.data.account.lastName,
                            avatar: res.data.account.avatar,
                            roles: res.data.account.roles.toString(),
                            accountCreation: createdDate.toDateString()
                        }
                    });
                } else {
                    console.log(res.data.errMsg);
                }
            } else {
                console.log(res.data.errMsg);
            }
        }).catch((err) => {
            console.log(err);
        });
    }

    render() {
        const Pane = (props) => {
            switch(this.state.activeItem) {
                case 'profile':
                    return (
                        <Segment basic className='pane-segment'>
                            <h2>Profile</h2>
                            <Divider />
                            <Grid divided='vertically'>
                                <Grid.Row>
                                    <Grid.Column width={4}>
                                        <Image src={`${this.state.accountData.avatar}`} size='medium' circular />
                                    </Grid.Column>
                                    <Grid.Column width={12}>
                                        <Header as='h2'>{this.state.accountData.firstName} {this.state.accountData.lastName}</Header>
                                        <Header sub>Role(s)</Header>
                                        <span>{this.state.accountData.roles}</span>
                                        <Header sub>LibreTexts team member since</Header>
                                        <span>2019</span>
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row>
                                    <Grid.Column width={16}>
                                        <Message>
                                            <Message.Header>Under Construction</Message.Header>
                                            <p>More profile features to come ;) </p>
                                        </Message>
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                    );
                case 'security':
                    return (
                        <Segment basic className='pane-segment'>
                            <h2>Security</h2>
                            <Divider />
                            <Form>
                                <Form.Group>
                                    <Form.Input fluid label='Email' placeholder='Email' value={this.state.accountData.email} readOnly width={16} />
                                </Form.Group>
                                <Form.Group>
                                    <Form.Input fluid label='Current Password' placeholder='********' readOnly width={16} />
                                </Form.Group>
                                <Form.Group>
                                    <Form.Input fluid label='New Password' placeholder="Sorry, you can't change your password here yet." readOnly width={16} />
                                </Form.Group>
                                <Button type='submit' floated='right' disabled>Save</Button>
                            </Form>
                        </Segment>
                    );
                default: // Overview
                    return (
                        <Segment basic className='pane-segment'>
                            <h2>Account Overview</h2>
                            <Divider />
                            <Grid>
                                <Grid.Row centered rows={1}>
                                    <Grid.Column width={4}>
                                        <Image src={`${this.state.accountData.avatar}`} size='medium' circular />
                                    </Grid.Column>
                                </Grid.Row>
                                <Grid.Row centered rows={1}>
                                    <Grid.Column width={8}>
                                        <Form>
                                            <Form.Group>
                                                <Form.Input fluid label='Email' placeholder='Email' value={this.state.accountData.email} readOnly width={16} />
                                            </Form.Group>
                                            <Form.Group>
                                                <Form.Input fluid label='First Name' placeholder='First Name' value={this.state.accountData.firstName} readOnly width={16} />
                                            </Form.Group>
                                            <Form.Group>
                                                <Form.Input fluid label='Last Name' placeholder='Last Name' value={this.state.accountData.lastName} readOnly width={16} />
                                            </Form.Group>
                                            <Form.Group>
                                                <Form.Input fluid label='Roles' placeholder='Roles' value={this.state.accountData.roles} readOnly width={16} />
                                            </Form.Group>
                                            <Form.Group>
                                                <Form.Input fluid label='Account Creation' placeholder='Account Creation' value={this.state.accountData.accountCreation} readOnly width={16} />
                                            </Form.Group>
                                        </Form>
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                    );
            }
        };
        return (
            <Grid className='component-container' divided='vertically'>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Header className='component-header'>Account Settings</Header>
                    </Grid.Column>
                </Grid.Row>
                <Grid.Row>
                    <Grid.Column width={16}>
                        <Segment>
                            <Grid>
                                <Grid.Row>
                                    <Grid.Column width={4}>
                                        <Menu fluid vertical color='blue' secondary pointing className='fullheight-menu'>
                                            <Menu.Item
                                                name='overview'
                                                active={this.state.activeItem === 'overview'}
                                                onClick={this.handleClick.bind(this)}
                                            >Account Overview</Menu.Item>
                                            <Menu.Item
                                                name='profile'
                                                active={this.state.activeItem === 'profile'}
                                                onClick={this.handleClick.bind(this)}
                                            >Profile</Menu.Item>
                                            <Menu.Item
                                                name='security'
                                                active={this.state.activeItem === 'security'}
                                                onClick={this.handleClick.bind(this)}
                                            >Security</Menu.Item>
                                        </Menu>
                                    </Grid.Column>
                                    <Grid.Column stretched width={12}>
                                        <Pane />
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                    </Grid.Column>
                </Grid.Row>
            </Grid>
        );
    }

}

export default AccountSettings;
