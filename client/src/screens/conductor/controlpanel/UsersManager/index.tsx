import '../../../../components/controlpanel/ControlPanel.css';

import {
    Grid,
    Header,
    Segment,
    Table,
    Button,
    Dropdown,
    Icon,
    Input,
    Breadcrumb,
} from 'semantic-ui-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTypedSelector } from '../../../../state/hooks.js';

import { itemsPerPageOptions } from '../../../../components/util/PaginationOptions.js';
import useGlobalError from '../../../../components/error/ErrorHooks.js';
import { User } from '../../../../types';
import ManageUserRolesModal from '../../../../components/controlpanel/UsersManager/ManageUserRolesModal.js';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../api';
import ConductorPagination from '../../../../components/util/ConductorPagination';
import useDebounce from '../../../../hooks/useDebounce';
import { useModals } from '../../../../context/ModalContext';

const UsersManager = () => {

    // Global State & Hooks
    const { handleGlobalError } = useGlobalError();
    const org = useTypedSelector((state) => state.org);
    const isSuperAdmin = useTypedSelector((state) => state.user.isSuperAdmin);
    const { debounce } = useDebounce();
    const { openModal, closeAllModals } = useModals();

    // UI
    const [page, setPage] = useState<number>(1);
    const [itemsPerPage, setItemsPerPage] = useState<number>(10);
    const [sortChoice, setSortChoice] = useState<string>('first');
    const [searchString, setSearchString] = useState<string>(''); // for debounce, this is the value that will be used
    const [searchInput, setSearchInput] = useState<string>(''); // for debounce, this is the input value

    const { data, isFetching: loading } = useQuery({
        queryKey: ['users', searchString, sortChoice, page, itemsPerPage],
        queryFn: () => getUsers({ query: searchString, limit: itemsPerPage, page, sort: sortChoice }),
        refetchOnWindowFocus: false,
    })

    const sortOptions = [
        { key: 'first', text: 'Sort by First Name', value: 'first' },
        { key: 'last', text: 'Sort by Last Name', value: 'last' },
        { key: 'email', text: 'Sort by Email', value: 'email' },
    ];


    useEffect(() => {
        document.title = "LibreTexts Conductor | Users Manager";
    }, []);

    async function getUsers({ query, limit, page, sort }: { query?: string, limit?: number, page?: number, sort?: string }): Promise<{
        results: User[],
        total_items: number
    }> {
        try {
            const res = await api.getUsers({ query, limit, page, sort })
            if (res.data.err) {
                throw new Error(res.data.errMsg)
            }

            return {
                results: res.data.results,
                total_items: res.data.total_items
            }
        } catch (err) {
            handleGlobalError(err);
            return {
                results: [],
                total_items: 0
            }
        }
    }

    const debouncedSearch = debounce((newVal: string) => {
        setSearchString(newVal);
    }, 200);

    const openManageUserModal = (uuid: string, firstName: string, lastName: string) => {
        if (!uuid) return;

        openModal(
            <ManageUserRolesModal
                firstName={firstName || ''}
                isSuperAdmin={isSuperAdmin}
                lastName={lastName || ''}
                onClose={closeAllModals}
                orgID={org?.orgID}
                show={true}
                uuid={uuid}
            />
        )
    };

    return (
        <Grid className='controlpanel-container' divided='vertically'>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Header className='component-header'>Users Manager</Header>
                </Grid.Column>
            </Grid.Row>
            <Grid.Row>
                <Grid.Column width={16}>
                    <Segment.Group>
                        <Segment>
                            <Breadcrumb>
                                <Breadcrumb.Section as={Link} to='/controlpanel'>
                                    Control Panel
                                </Breadcrumb.Section>
                                <Breadcrumb.Divider icon='right chevron' />
                                <Breadcrumb.Section active>
                                    Users Manager
                                </Breadcrumb.Section>
                            </Breadcrumb>
                        </Segment>
                        <Segment>
                            <Grid>
                                <Grid.Row>
                                    <Grid.Column width={11}>
                                        <Dropdown
                                            placeholder='Sort by...'
                                            floating
                                            selection
                                            button
                                            options={sortOptions}
                                            onChange={(_e, { value }) => { setSortChoice(value as string) }}
                                            value={sortChoice}
                                        />
                                    </Grid.Column>
                                    <Grid.Column width={5}>
                                        <Input
                                            icon='search'
                                            placeholder='Search...'
                                            onChange={(e) => {
                                                setSearchInput(e.target.value);
                                                debouncedSearch(e.target.value);
                                            }}
                                            value={searchInput}
                                            fluid
                                        />
                                    </Grid.Column>
                                </Grid.Row>
                            </Grid>
                        </Segment>
                        <Segment>
                            <div className='flex-row-div'>
                                <div className='left-flex'>
                                    <span>Displaying </span>
                                    <Dropdown
                                        className='commons-content-pagemenu-dropdown'
                                        selection
                                        options={itemsPerPageOptions}
                                        onChange={(_e, { value }) => {
                                            setItemsPerPage(value as number);
                                        }}
                                        value={itemsPerPage}
                                    />
                                    <span> items per page of <strong>{Number(data?.total_items || 0).toLocaleString()}</strong> results.</span>
                                </div>
                                <div className='right-flex'>
                                    <ConductorPagination
                                        activePage={page}
                                        totalPages={data && data.total_items > 0 ? Math.ceil(data?.total_items / itemsPerPage) : 1}
                                        onPageChange={(e, { activePage }) => {
                                            setPage(activePage as number);
                                        }}
                                    />
                                </div>
                            </div>
                        </Segment>
                        <Segment loading={loading}>
                            <Table striped celled fixed>
                                <Table.Header>
                                    <Table.Row>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'first')
                                                ? <span><em>First Name</em></span>
                                                : <span>First Name</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'last')
                                                ? <span><em>Last Name</em></span>
                                                : <span>Last Name</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            {(sortChoice === 'email')
                                                ? <span><em>Email</em></span>
                                                : <span>Email</span>
                                            }
                                        </Table.HeaderCell>
                                        <Table.HeaderCell>
                                            <span>Actions</span>
                                        </Table.HeaderCell>
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {(data && data.results.length > 0) &&
                                        data.results.map((item, index) => {
                                            return (
                                                <Table.Row key={index}>
                                                    <Table.Cell>
                                                        <p>{item.firstName}</p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{item.lastName}</p>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <p>{item.email}</p>
                                                    </Table.Cell>
                                                    <Table.Cell textAlign='center'>
                                                        <Button.Group vertical fluid>
                                                            <Button
                                                                color='blue'
                                                                onClick={() => { openManageUserModal(item.uuid, item.firstName, item.lastName) }}
                                                            >
                                                                <Icon name='user doctor' />
                                                                <span>Manage Roles</span>
                                                            </Button>
                                                            <Button
                                                                color='teal'
                                                                as={Link}
                                                                to={`/controlpanel/usersmanager/${item.uuid}`}
                                                            >
                                                                <Icon name='list ul' />
                                                                <span>View Projects</span>
                                                            </Button>
                                                        </Button.Group>
                                                    </Table.Cell>
                                                </Table.Row>
                                            )
                                        })
                                    }
                                    {(!data || data.results.length === 0) &&
                                        <Table.Row>
                                            <Table.Cell colSpan={4}>
                                                <p className='text-center'><em>No results found.</em></p>
                                            </Table.Cell>
                                        </Table.Row>
                                    }
                                </Table.Body>
                            </Table>
                        </Segment>
                    </Segment.Group>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )

}

export default UsersManager;
