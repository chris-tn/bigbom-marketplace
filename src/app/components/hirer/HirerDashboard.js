import React, { Component } from 'react';
import Grid from '@material-ui/core/Grid';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import ButtonBase from '@material-ui/core/ButtonBase';
import Tooltip from '@material-ui/core/Tooltip';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import Switch from '@material-ui/core/Switch';

const styles = () => ({
    lightTooltip: {
        fontSize: 15,
        maxWidth: 'inherit',
    },
});

const jobs = [
    {
        id: 'wwkrjhfs',
        title: 'Design some banner ad',
        awardedBid: '200',
        currency: 'USD',
        time: '10 days',
        status: 'started',
    },
    {
        id: 'wwkjh3fs',
        title: 'Write program to scrap data from webpage (javascript)',
        awardedBid: '200',
        currency: 'USD',
        time: '10 days',
        status: 'completed',
    },
    {
        id: 'wwkjhfs3',
        title: 'Reactjs website development with AWS amplify, API integration',
        awardedBid: '200',
        currency: 'USD',
        time: '10 days',
        status: 'bidding',
    },
    {
        id: 'wwkjhfsh3',
        title: 'Build me a push notification software',
        awardedBid: '200',
        currency: 'USD',
        time: '10 days',
        status: 'bidding',
    },
];

class HirerDashboard extends Component {
    state = {
        checkedStarted: true,
        checkedCompleted: true,
        checkedBidding: true,
        checkedExpired: false,
    };
    handleChange = name => event => {
        this.setState({ [name]: event.target.checked });
    };
    render() {
        const { classes } = this.props;
        return (
            <div id="hirer" className="container-wrp">
                <div className="container-wrp full-top-wrp">
                    <div className="container wrapper">
                        <Grid container className="main-intro">
                            <Grid item xs={8}>
                                <h1>Your Jobs</h1>
                            </Grid>
                            <Grid item xs={4} className="main-intro-right">
                                <ButtonBase className="btn btn-normal btn-white btn-create">
                                    <FontAwesomeIcon icon="plus" /> Create A New Job
                                </ButtonBase>
                            </Grid>
                        </Grid>
                    </div>
                </div>
                <div className="container-wrp main-ct">
                    <div className="container wrapper">
                        <Grid container className="single-body">
                            <fieldset className="list-filter">
                                <legend>Filter:</legend>
                                <Grid container className="list-filter-body">
                                    <Grid item xs={2}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={this.state.checkedStarted}
                                                    onChange={this.handleChange('checkedStarted')}
                                                    value="checkedStarted"
                                                />
                                            }
                                            label="Started"
                                        />
                                    </Grid>
                                    <Grid item xs={2}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={this.state.checkedCompleted}
                                                    onChange={this.handleChange('checkedCompleted')}
                                                    value="checkedCompleted"
                                                />
                                            }
                                            label="Completed"
                                        />
                                    </Grid>
                                    <Grid item xs={2}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={this.state.checkedBidding}
                                                    onChange={this.handleChange('checkedBidding')}
                                                    value="checkedBidding"
                                                />
                                            }
                                            label="Bidding"
                                        />
                                    </Grid>
                                    <Grid item xs={2}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={this.state.checkedExpired}
                                                    onChange={this.handleChange('checkedExpired')}
                                                    value="checkedExpired"
                                                />
                                            }
                                            label="Expired"
                                        />
                                    </Grid>
                                </Grid>
                            </fieldset>
                            <Grid container className="list-container">
                                <Grid container className="list-header">
                                    <Grid item xs={5}>
                                        Job name
                                    </Grid>
                                    <Grid item xs={2}>
                                        Awarded Bid
                                    </Grid>
                                    <Grid item xs={2}>
                                        Time
                                    </Grid>
                                    <Grid item xs={2}>
                                        Status
                                    </Grid>
                                    <Grid item xs={1}>
                                        Action
                                    </Grid>
                                </Grid>
                                <Grid container className="list-body">
                                    {jobs.map(job => {
                                        return (
                                            <Grid key={job.id} container className="list-body-row">
                                                <Grid item xs={5} className="title">
                                                    <a href="/">{job.title}</a>
                                                </Grid>
                                                <Grid item xs={2}>
                                                    {job.awardedBid} {job.currency}
                                                </Grid>
                                                <Grid item xs={2}>
                                                    {job.time}
                                                </Grid>
                                                <Grid item xs={2}>
                                                    {job.status}
                                                </Grid>
                                                <Grid item xs={1} className="action">
                                                    <Tooltip
                                                        title="Cancel"
                                                        classes={{
                                                            tooltip: classes.lightTooltip,
                                                            popper: classes.arrowPopper,
                                                        }}
                                                    >
                                                        <ButtonBase aria-label="Cancel" className="cancel">
                                                            <FontAwesomeIcon icon="minus-circle" />
                                                        </ButtonBase>
                                                    </Tooltip>
                                                </Grid>
                                            </Grid>
                                        );
                                    })}
                                </Grid>
                            </Grid>
                        </Grid>
                    </div>
                </div>
            </div>
        );
    }
}
HirerDashboard.propTypes = {
    classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(HirerDashboard);
