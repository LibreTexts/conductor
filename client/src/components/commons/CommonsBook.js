import './Commons.css';

import { Grid, Image, Icon, Segment, Header, Button, Accordion, List } from 'semantic-ui-react';
import React, { useEffect, useState } from 'react';
//import axios from 'axios';


import demoBooks from '../util/DemoBooks.js';

const CommonsBook = (props) => {

    const book = demoBooks[props.match.params.id-1];
    const [activeAccordion, setActiveAccordion] = useState(-1);
    const [tocChapterPanels, setTOCCPanels] = useState([]);

    const listFactory = (pages) => {
        return (
            <List bulleted>
                {pages.map((page, idx) => {
                    return (
                        <List.Item key={idx} header={page} />
                    )
                })}
            </List>
        )
    };

    useEffect(() => {
        document.title = "LibreTexts | " + book.title;
        if (book.contents !== undefined) {
            var chapters = [];
            book.contents.forEach((item, idx) => {
                chapters.push({
                    key: `chapter-${idx}`,
                    title: item.title,
                    content: { content: listFactory(item.pages) }
                });
            });
            setTOCCPanels(chapters);
        }
    }, [book.title, book.contents]);

    const handleAccordionClick = (e, { index }) => {
        setActiveAccordion(index);
    };

    return (
        <Grid className='commons-container'>
            <Grid.Row>
                <Grid.Column>
                    <Segment>
                        <Grid divided>
                            <Grid.Row>
                                <Grid.Column width={4}>
                                    <Image id='commons-book-image' src={book.thumbnail} />
                                    <Header as='h2'>{book.title}</Header>
                                    <p><Icon name='user'/> {book.author}</p>
                                    <p>
                                        <Image src='https://libretexts.org/img/LibreTexts/glyphs/chem.png' className='commons-content-glyph' inline/>
                                        {String(book.library).charAt(0).toUpperCase() + String(book.library).slice(1)}
                                    </p>
                                    <p><Icon name='university'/> University of California, Davis</p>
                                    <Button.Group id='commons-book-actions' vertical labeled icon fluid color='blue'>
                                        <Button icon='linkify' content='Read Online' as='a' href={book.links.online} target='_blank' rel='noopener noreferrer' />
                                        <Button icon='file pdf' content='Download PDF' as='a' href={book.links.pdf} target='_blank' rel='noopener noreferrer'/>
                                        <Button icon='shopping cart' content='Buy Print Copy' as='a' href={book.links.buy} target='_blank' rel='noopener noreferrer'/>
                                        <Button icon='zip' content='Download Pages ZIP' as='a' href={book.links.zip} target='_blank' rel='noopener noreferrer'/>
                                        <Button icon='book' content='Download Print Files' as='a' href={book.links.files} target='_blank' rel='noopener noreferrer'/>
                                        <Button icon='graduation cap' content='Download LMS File' as='a' href={book.links.lms} target='_blank' rel='noopener noreferrer'/>
                                    </Button.Group>
                                </Grid.Column>
                                <Grid.Column width={12}>
                                    <Segment>
                                        <Header as='h3' dividing>Summary</Header>
                                        <p>{book.summary}</p>
                                    </Segment>
                                    <Accordion styled fluid>
                                        <Accordion.Title
                                            index={0}
                                            active={activeAccordion === 0}
                                            onClick={handleAccordionClick}
                                        >
                                            <Icon name='dropdown' />
                                            Table of Contents
                                        </Accordion.Title>
                                        <Accordion.Content active={activeAccordion === 0}>
                                            <Accordion.Accordion panels={tocChapterPanels} />
                                        </Accordion.Content>
                                        <Accordion.Title
                                            index={1}
                                            active={activeAccordion === 1}
                                            onClick={handleAccordionClick}
                                        >
                                            <Icon name='dropdown' />
                                            Book Preview
                                        </Accordion.Title>
                                        <Accordion.Content active={activeAccordion === 1}>
                                            <iframe id='commons-book-preview' src={book.preview} loading='lazy' title="Book Preview Frame" />
                                        </Accordion.Content>
                                    </Accordion>
                                </Grid.Column>
                            </Grid.Row>
                        </Grid>
                    </Segment>
                </Grid.Column>
            </Grid.Row>
        </Grid>
    )
}

export default CommonsBook;


/*
<List>
    {book.contents.map((item, index) => {
        return (
            <List.Item key={index}>
                <List.Icon name='folder open' />
                <List.Content>
                    <List.Header>{item.name}</List.Header>
                    <List.List>
                    {item.pages.map((page, pageIdx) => {
                        return (
                            <List.Item key={pageIdx}>
                                <List.Icon name='content' />
                                <List.Content>
                                    <List.Header>{page}</List.Header>
                                </List.Content>
                            </List.Item>
                        )
                    })}
                    </List.List>
                </List.Content>
            </List.Item>
        )
    })}
</List>
*/
